import { BigintIsh, Price, sqrt, Token, CurrencyAmount } from '@liuqiang1357/uniswap-sdk-core'
import invariant from 'tiny-invariant'
import bigInt, { BigInteger } from 'big-integer'
import { pack, keccak256 } from '@ethersproject/solidity'
import { getCreate2Address } from '@ethersproject/address'

import { FACTORY_ADDRESS, INIT_CODE_HASH, MINIMUM_LIQUIDITY, FIVE, _997, _1000, ONE, ZERO } from '../constants'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'

export const computePairAddress = ({
  factoryAddress,
  tokenA,
  tokenB
}: {
  factoryAddress: string
  tokenA: Token
  tokenB: Token
}): string => {
  const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks
  return getCreate2Address(
    factoryAddress,
    keccak256(['bytes'], [pack(['address', 'address'], [token0.address, token1.address])]),
    INIT_CODE_HASH
  )
}
export class Pair {
  public readonly liquidityToken: Token
  private readonly tokenAmounts: [CurrencyAmount<Token>, CurrencyAmount<Token>]

  public static getAddress(tokenA: Token, tokenB: Token): string {
    return computePairAddress({ factoryAddress: FACTORY_ADDRESS, tokenA, tokenB })
  }

  public constructor(currencyAmountA: CurrencyAmount<Token>, tokenAmountB: CurrencyAmount<Token>) {
    const tokenAmounts = currencyAmountA.currency.sortsBefore(tokenAmountB.currency) // does safety checks
      ? [currencyAmountA, tokenAmountB]
      : [tokenAmountB, currencyAmountA]
    this.liquidityToken = new Token(
      tokenAmounts[0].currency.chainId,
      Pair.getAddress(tokenAmounts[0].currency, tokenAmounts[1].currency),
      18,
      'UNI-V2',
      'Uniswap V2'
    )
    this.tokenAmounts = tokenAmounts as [CurrencyAmount<Token>, CurrencyAmount<Token>]
  }

  /**
   * Returns true if the token is either token0 or token1
   * @param token to check
   */
  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1)
  }

  /**
   * Returns the current mid price of the pair in terms of token0, i.e. the ratio of reserve1 to reserve0
   */
  public get token0Price(): Price<Token, Token> {
    const result = this.tokenAmounts[1].divide(this.tokenAmounts[0])
    return new Price(this.token0, this.token1, result.denominator, result.numerator)
  }

  /**
   * Returns the current mid price of the pair in terms of token1, i.e. the ratio of reserve0 to reserve1
   */
  public get token1Price(): Price<Token, Token> {
    const result = this.tokenAmounts[0].divide(this.tokenAmounts[1])
    return new Price(this.token1, this.token0, result.denominator, result.numerator)
  }

  /**
   * Return the price of the given token in terms of the other token in the pair.
   * @param token token to return price of
   */
  public priceOf(token: Token): Price<Token, Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0) ? this.token0Price : this.token1Price
  }

  /**
   * Returns the chain ID of the tokens in the pair.
   */
  public get chainId(): number {
    return this.token0.chainId
  }

  public get token0(): Token {
    return this.tokenAmounts[0].currency
  }

  public get token1(): Token {
    return this.tokenAmounts[1].currency
  }

  public get reserve0(): CurrencyAmount<Token> {
    return this.tokenAmounts[0]
  }

  public get reserve1(): CurrencyAmount<Token> {
    return this.tokenAmounts[1]
  }

  public reserveOf(token: Token): CurrencyAmount<Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0) ? this.reserve0 : this.reserve1
  }

  public getOutputAmount(inputAmount: CurrencyAmount<Token>): [CurrencyAmount<Token>, Pair] {
    invariant(this.involvesToken(inputAmount.currency), 'TOKEN')
    if (this.reserve0.quotient.equals(ZERO) || this.reserve1.quotient.equals(ZERO)) {
      throw new InsufficientReservesError()
    }
    const inputReserve = this.reserveOf(inputAmount.currency)
    const outputReserve = this.reserveOf(inputAmount.currency.equals(this.token0) ? this.token1 : this.token0)
    const inputAmountWithFee = inputAmount.quotient.multiply(_997)
    const numerator = inputAmountWithFee.multiply(outputReserve.quotient)
    const denominator = inputReserve.quotient.multiply(_1000).add(inputAmountWithFee)
    const outputAmount = CurrencyAmount.fromRawAmount(
      inputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
      numerator.divide(denominator)
    )
    if (outputAmount.quotient.equals(ZERO)) {
      throw new InsufficientInputAmountError()
    }
    return [outputAmount, new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
  }

  public getInputAmount(outputAmount: CurrencyAmount<Token>): [CurrencyAmount<Token>, Pair] {
    invariant(this.involvesToken(outputAmount.currency), 'TOKEN')
    if (
      this.reserve0.quotient.equals(ZERO) ||
      this.reserve1.quotient.equals(ZERO) ||
      outputAmount.quotient.greaterOrEquals(this.reserveOf(outputAmount.currency).quotient)
    ) {
      throw new InsufficientReservesError()
    }

    const outputReserve = this.reserveOf(outputAmount.currency)
    const inputReserve = this.reserveOf(outputAmount.currency.equals(this.token0) ? this.token1 : this.token0)
    const numerator = inputReserve.quotient.multiply(outputAmount.quotient).multiply(_1000)
    const denominator = outputReserve.quotient.subtract(outputAmount.quotient).multiply(_997)
    const inputAmount = CurrencyAmount.fromRawAmount(
      outputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
      numerator.divide(denominator).add(ONE)
    )
    return [inputAmount, new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
  }

  public getLiquidityMinted(
    totalSupply: CurrencyAmount<Token>,
    tokenAmountA: CurrencyAmount<Token>,
    tokenAmountB: CurrencyAmount<Token>
  ): CurrencyAmount<Token> {
    invariant(totalSupply.currency.equals(this.liquidityToken), 'LIQUIDITY')
    const tokenAmounts = tokenAmountA.currency.sortsBefore(tokenAmountB.currency) // does safety checks
      ? [tokenAmountA, tokenAmountB]
      : [tokenAmountB, tokenAmountA]
    invariant(tokenAmounts[0].currency.equals(this.token0) && tokenAmounts[1].currency.equals(this.token1), 'TOKEN')

    let liquidity: BigInteger
    if (totalSupply.quotient.equals(ZERO)) {
      liquidity = sqrt(tokenAmounts[0].quotient.multiply(tokenAmounts[1].quotient)).subtract(MINIMUM_LIQUIDITY)
    } else {
      const amount0 = tokenAmounts[0].quotient.multiply(totalSupply.quotient).divide(this.reserve0.quotient)
      const amount1 = tokenAmounts[1].quotient.multiply(totalSupply.quotient).divide(this.reserve1.quotient)
      liquidity = amount0.lesserOrEquals(amount1) ? amount0 : amount1
    }
    if (!liquidity.greater(ZERO)) {
      throw new InsufficientInputAmountError()
    }
    return CurrencyAmount.fromRawAmount(this.liquidityToken, liquidity)
  }

  public getLiquidityValue(
    token: Token,
    totalSupply: CurrencyAmount<Token>,
    liquidity: CurrencyAmount<Token>,
    feeOn: boolean = false,
    kLast?: BigintIsh
  ): CurrencyAmount<Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    invariant(totalSupply.currency.equals(this.liquidityToken), 'TOTAL_SUPPLY')
    invariant(liquidity.currency.equals(this.liquidityToken), 'LIQUIDITY')
    invariant(liquidity.quotient.lesserOrEquals(totalSupply.quotient), 'LIQUIDITY')

    let totalSupplyAdjusted: CurrencyAmount<Token>
    if (!feeOn) {
      totalSupplyAdjusted = totalSupply
    } else {
      invariant(!!kLast, 'K_LAST')
      const kLastParsed = bigInt(String(kLast))
      if (!kLastParsed.equals(ZERO)) {
        const rootK = sqrt(this.reserve0.quotient.multiply(this.reserve1.quotient))
        const rootKLast = sqrt(kLastParsed)
        if (rootK.greater(rootKLast)) {
          const numerator = totalSupply.quotient.multiply(rootK.subtract(rootKLast))
          const denominator = rootK.multiply(FIVE).add(rootKLast)
          const feeLiquidity = numerator.divide(denominator)
          totalSupplyAdjusted = totalSupply.add(CurrencyAmount.fromRawAmount(this.liquidityToken, feeLiquidity))
        } else {
          totalSupplyAdjusted = totalSupply
        }
      } else {
        totalSupplyAdjusted = totalSupply
      }
    }

    return CurrencyAmount.fromRawAmount(
      token,
      liquidity.quotient.multiply(this.reserveOf(token).quotient).divide(totalSupplyAdjusted.quotient)
    )
  }
}
