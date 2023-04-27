import { Pair } from './pair'
import { Route } from './route'
import { Trade } from './trade'
import bigInt from 'big-integer'
import { Ether, CurrencyAmount, Percent, Token, TradeType, WETH9, Price, Fraction } from '@liuqiang1357/uniswap-sdk-core'

describe('Trade', () => {
  const ETHER = Ether.onChain(1)
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1')
  const token2 = new Token(1, '0x0000000000000000000000000000000000000003', 18, 't2')
  const token3 = new Token(1, '0x0000000000000000000000000000000000000004', 18, 't3')
  const FEE_RATE = new Fraction(3, 1000);

  const pair_0_1 = new Pair(
    CurrencyAmount.fromRawAmount(token0, bigInt(1000)),
    CurrencyAmount.fromRawAmount(token1, bigInt(1000))
  )
  const pair_0_2 = new Pair(
    CurrencyAmount.fromRawAmount(token0, bigInt(1000)),
    CurrencyAmount.fromRawAmount(token2, bigInt(1100))
  )
  const pair_0_3 = new Pair(
    CurrencyAmount.fromRawAmount(token0, bigInt(1000)),
    CurrencyAmount.fromRawAmount(token3, bigInt(900))
  )
  const pair_1_2 = new Pair(
    CurrencyAmount.fromRawAmount(token1, bigInt(1200)),
    CurrencyAmount.fromRawAmount(token2, bigInt(1000))
  )
  const pair_1_3 = new Pair(
    CurrencyAmount.fromRawAmount(token1, bigInt(1200)),
    CurrencyAmount.fromRawAmount(token3, bigInt(1300))
  )

  const pair_weth_0 = new Pair(
    CurrencyAmount.fromRawAmount(WETH9[1], bigInt(1000)),
    CurrencyAmount.fromRawAmount(token0, bigInt(1000))
  )

  const empty_pair_0_1 = new Pair(
    CurrencyAmount.fromRawAmount(token0, bigInt(0)),
    CurrencyAmount.fromRawAmount(token1, bigInt(0))
  )

  it('can be constructed with ETHER as input', () => {
    const trade = new Trade(
      new Route([pair_weth_0], ETHER, token0),
      CurrencyAmount.fromRawAmount(Ether.onChain(1), bigInt(100)),
      TradeType.EXACT_INPUT,
      FEE_RATE
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })
  it('can be constructed with ETHER as input for exact output', () => {
    const trade = new Trade(
      new Route([pair_weth_0], ETHER, token0),
      CurrencyAmount.fromRawAmount(token0, bigInt(100)),
      TradeType.EXACT_OUTPUT,
      FEE_RATE
    )
    expect(trade.inputAmount.currency).toEqual(ETHER)
    expect(trade.outputAmount.currency).toEqual(token0)
  })

  it('can be constructed with ETHER as output', () => {
    const trade = new Trade(
      new Route([pair_weth_0], token0, ETHER),
      CurrencyAmount.fromRawAmount(Ether.onChain(1), bigInt(100)),
      TradeType.EXACT_OUTPUT,
      FEE_RATE
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })
  it('can be constructed with ETHER as output for exact input', () => {
    const trade = new Trade(
      new Route([pair_weth_0], token0, ETHER),
      CurrencyAmount.fromRawAmount(token0, bigInt(100)),
      TradeType.EXACT_INPUT,
      FEE_RATE
    )
    expect(trade.inputAmount.currency).toEqual(token0)
    expect(trade.outputAmount.currency).toEqual(ETHER)
  })

  describe('#bestTradeExactIn', () => {
    it('throws with empty pairs', () => {
      expect(() => Trade.bestTradeExactIn([], CurrencyAmount.fromRawAmount(token0, bigInt(100)), token2, FEE_RATE)).toThrow(
        'PAIRS'
      )
    })
    it('throws with max hops of 0', () => {
      expect(() =>
        Trade.bestTradeExactIn([pair_0_2], CurrencyAmount.fromRawAmount(token0, bigInt(100)), token2, FEE_RATE, {
          maxHops: 0
        })
      ).toThrow('MAX_HOPS')
    })

    it('provides best route', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        CurrencyAmount.fromRawAmount(token0, bigInt(100)),
        token2,
        FEE_RATE
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(CurrencyAmount.fromRawAmount(token0, bigInt(100)))
      expect(result[0].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, bigInt(99)))
      expect(result[1].route.pairs).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.path).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(CurrencyAmount.fromRawAmount(token0, bigInt(100)))
      expect(result[1].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, bigInt(69)))
    })

    it('doesnt throw for zero liquidity pairs', () => {
      expect(
        Trade.bestTradeExactIn([empty_pair_0_1], CurrencyAmount.fromRawAmount(token0, bigInt(100)), token1, FEE_RATE)
      ).toHaveLength(0)
    })

    it('respects maxHops', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        CurrencyAmount.fromRawAmount(token0, bigInt(10)),
        token2,
        FEE_RATE,
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
    })

    it('insufficient input for one pair', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        CurrencyAmount.fromRawAmount(token0, bigInt(1)),
        token2,
        FEE_RATE
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
      expect(result[0].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, bigInt(1)))
    })

    it('respects n', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_2, pair_1_2],
        CurrencyAmount.fromRawAmount(token0, bigInt(10)),
        token2,
        FEE_RATE,
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', () => {
      const result = Trade.bestTradeExactIn(
        [pair_0_1, pair_0_3, pair_1_3],
        CurrencyAmount.fromRawAmount(token0, bigInt(10)),
        token2,
        FEE_RATE
      )
      expect(result).toHaveLength(0)
    })

    it('works for ETHER currency input', () => {
      const result = Trade.bestTradeExactIn(
        [pair_weth_0, pair_0_1, pair_0_3, pair_1_3],
        CurrencyAmount.fromRawAmount(Ether.onChain(1), bigInt(100)),
        token3,
        FEE_RATE
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(ETHER)
      expect(result[0].route.path).toEqual([WETH9[1], token0, token1, token3])
      expect(result[0].outputAmount.currency).toEqual(token3)
      expect(result[1].inputAmount.currency).toEqual(ETHER)
      expect(result[1].route.path).toEqual([WETH9[1], token0, token3])
      expect(result[1].outputAmount.currency).toEqual(token3)
    })
    it('works for ETHER currency output', () => {
      const result = Trade.bestTradeExactIn(
        [pair_weth_0, pair_0_1, pair_0_3, pair_1_3],
        CurrencyAmount.fromRawAmount(token3, bigInt(100)),
        ETHER,
        FEE_RATE
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(token3)
      expect(result[0].route.path).toEqual([token3, token0, WETH9[1]])
      expect(result[0].outputAmount.currency).toEqual(ETHER)
      expect(result[1].inputAmount.currency).toEqual(token3)
      expect(result[1].route.path).toEqual([token3, token1, token0, WETH9[1]])
      expect(result[1].outputAmount.currency).toEqual(ETHER)
    })
  })

  describe('#maximumAmountIn', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pair_0_1, pair_1_2], token0, token2),
        CurrencyAmount.fromRawAmount(token0, bigInt(100)),
        TradeType.EXACT_INPUT,
        FEE_RATE
      )
      it('throws if less than 0', () => {
        expect(() => exactIn.maximumAmountIn(new Percent(bigInt(-1), bigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactIn.maximumAmountIn(new Percent(bigInt(0), bigInt(100)))).toEqual(exactIn.inputAmount)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.maximumAmountIn(new Percent(bigInt(0), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, bigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(bigInt(5), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, bigInt(100))
        )
        expect(exactIn.maximumAmountIn(new Percent(bigInt(200), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, bigInt(100))
        )
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pair_0_1, pair_1_2], token0, token2),
        CurrencyAmount.fromRawAmount(token2, bigInt(100)),
        TradeType.EXACT_OUTPUT,
        FEE_RATE
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.maximumAmountIn(new Percent(bigInt(-1), bigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactOut.maximumAmountIn(new Percent(bigInt(0), bigInt(100)))).toEqual(exactOut.inputAmount)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.maximumAmountIn(new Percent(bigInt(0), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, bigInt(156))
        )
        expect(exactOut.maximumAmountIn(new Percent(bigInt(5), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, bigInt(163))
        )
        expect(exactOut.maximumAmountIn(new Percent(bigInt(200), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token0, bigInt(468))
        )
      })
    })
  })

  describe('#minimumAmountOut', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pair_0_1, pair_1_2], token0, token2),
        CurrencyAmount.fromRawAmount(token0, bigInt(100)),
        TradeType.EXACT_INPUT,
        FEE_RATE
      )
      it('throws if less than 0', () => {
        expect(() => exactIn.minimumAmountOut(new Percent(bigInt(-1), bigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactIn.minimumAmountOut(new Percent(bigInt(0), bigInt(100)))).toEqual(exactIn.outputAmount)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.minimumAmountOut(new Percent(bigInt(0), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token2, bigInt(69))
        )
        expect(exactIn.minimumAmountOut(new Percent(bigInt(5), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token2, bigInt(65))
        )
        expect(exactIn.minimumAmountOut(new Percent(bigInt(200), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token2, bigInt(23))
        )
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pair_0_1, pair_1_2], token0, token2),
        CurrencyAmount.fromRawAmount(token2, bigInt(100)),
        TradeType.EXACT_OUTPUT,
        FEE_RATE
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.minimumAmountOut(new Percent(bigInt(-1), bigInt(100)))).toThrow(
          'SLIPPAGE_TOLERANCE'
        )
      })
      it('returns exact if 0', () => {
        expect(exactOut.minimumAmountOut(new Percent(bigInt(0), bigInt(100)))).toEqual(exactOut.outputAmount)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.minimumAmountOut(new Percent(bigInt(0), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token2, bigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(bigInt(5), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token2, bigInt(100))
        )
        expect(exactOut.minimumAmountOut(new Percent(bigInt(200), bigInt(100)))).toEqual(
          CurrencyAmount.fromRawAmount(token2, bigInt(100))
        )
      })
    })
  })

  describe('#worstExecutionPrice', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = new Trade(
        new Route([pair_0_1, pair_1_2], token0, token2),
        CurrencyAmount.fromRawAmount(token0, 100),
        TradeType.EXACT_INPUT,
        FEE_RATE
      )
      it('throws if less than 0', () => {
        expect(() => exactIn.minimumAmountOut(new Percent(-1, 100))).toThrow('SLIPPAGE_TOLERANCE')
      })
      it('returns exact if 0', () => {
        expect(exactIn.worstExecutionPrice(new Percent(0, 100))).toEqual(exactIn.executionPrice)
      })
      it('returns exact if nonzero', () => {
        expect(exactIn.worstExecutionPrice(new Percent(0, 100))).toEqual(new Price(token0, token2, 100, 69))
        expect(exactIn.worstExecutionPrice(new Percent(5, 100))).toEqual(new Price(token0, token2, 100, 65))
        expect(exactIn.worstExecutionPrice(new Percent(200, 100))).toEqual(new Price(token0, token2, 100, 23))
      })
    })
    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = new Trade(
        new Route([pair_0_1, pair_1_2], token0, token2),
        CurrencyAmount.fromRawAmount(token2, 100),
        TradeType.EXACT_OUTPUT,
        FEE_RATE
      )

      it('throws if less than 0', () => {
        expect(() => exactOut.worstExecutionPrice(new Percent(-1, 100))).toThrow('SLIPPAGE_TOLERANCE')
      })
      it('returns exact if 0', () => {
        expect(exactOut.worstExecutionPrice(new Percent(0, 100))).toEqual(exactOut.executionPrice)
      })
      it('returns slippage amount if nonzero', () => {
        expect(exactOut.worstExecutionPrice(new Percent(0, 100))).toEqual(new Price(token0, token2, 156, 100))
        expect(exactOut.worstExecutionPrice(new Percent(5, 100))).toEqual(new Price(token0, token2, 163, 100))
        expect(exactOut.worstExecutionPrice(new Percent(200, 100))).toEqual(new Price(token0, token2, 468, 100))
      })
    })
  })

  describe('#bestTradeExactOut', () => {
    it('throws with empty pairs', () => {
      expect(() => Trade.bestTradeExactOut([], token0, CurrencyAmount.fromRawAmount(token2, bigInt(100)), FEE_RATE)).toThrow(
        'PAIRS'
      )
    })
    it('throws with max hops of 0', () => {
      expect(() =>
        Trade.bestTradeExactOut([pair_0_2], token0, CurrencyAmount.fromRawAmount(token2, bigInt(100)),FEE_RATE, {
          maxHops: 0
        })
      ).toThrow('MAX_HOPS')
    })

    it('provides best route', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, bigInt(100)),
        FEE_RATE
      )
      expect(result).toHaveLength(2)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
      expect(result[0].inputAmount).toEqual(CurrencyAmount.fromRawAmount(token0, bigInt(101)))
      expect(result[0].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, bigInt(100)))
      expect(result[1].route.pairs).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
      expect(result[1].route.path).toEqual([token0, token1, token2])
      expect(result[1].inputAmount).toEqual(CurrencyAmount.fromRawAmount(token0, bigInt(156)))
      expect(result[1].outputAmount).toEqual(CurrencyAmount.fromRawAmount(token2, bigInt(100)))
    })

    it('doesnt throw for zero liquidity pairs', () => {
      expect(
        Trade.bestTradeExactOut([empty_pair_0_1], token1, CurrencyAmount.fromRawAmount(token1, bigInt(100)), FEE_RATE)
      ).toHaveLength(0)
    })

    it('respects maxHops', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, bigInt(10)),
        FEE_RATE,
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
      expect(result[0].route.path).toEqual([token0, token2])
    })

    it('insufficient liquidity', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, bigInt(1200)),
        FEE_RATE
      )
      expect(result).toHaveLength(0)
    })

    it('insufficient liquidity in one pair but not the other', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, bigInt(1050)),
        FEE_RATE
      )
      expect(result).toHaveLength(1)
    })

    it('respects n', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_2, pair_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, bigInt(10)),
        FEE_RATE,
        { maxNumResults: 1 }
      )

      expect(result).toHaveLength(1)
    })

    it('no path', () => {
      const result = Trade.bestTradeExactOut(
        [pair_0_1, pair_0_3, pair_1_3],
        token0,
        CurrencyAmount.fromRawAmount(token2, bigInt(10)),
        FEE_RATE
      )
      expect(result).toHaveLength(0)
    })

    it('works for ETHER currency input', () => {
      const result = Trade.bestTradeExactOut(
        [pair_weth_0, pair_0_1, pair_0_3, pair_1_3],
        ETHER,
        CurrencyAmount.fromRawAmount(token3, bigInt(100)),
        FEE_RATE
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(ETHER)
      expect(result[0].route.path).toEqual([WETH9[1], token0, token1, token3])
      expect(result[0].outputAmount.currency).toEqual(token3)
      expect(result[1].inputAmount.currency).toEqual(ETHER)
      expect(result[1].route.path).toEqual([WETH9[1], token0, token3])
      expect(result[1].outputAmount.currency).toEqual(token3)
    })
    it('works for ETHER currency output', () => {
      const result = Trade.bestTradeExactOut(
        [pair_weth_0, pair_0_1, pair_0_3, pair_1_3],
        token3,
        CurrencyAmount.fromRawAmount(Ether.onChain(1), bigInt(100)),
        FEE_RATE
      )
      expect(result).toHaveLength(2)
      expect(result[0].inputAmount.currency).toEqual(token3)
      expect(result[0].route.path).toEqual([token3, token0, WETH9[1]])
      expect(result[0].outputAmount.currency).toEqual(ETHER)
      expect(result[1].inputAmount.currency).toEqual(token3)
      expect(result[1].route.path).toEqual([token3, token1, token0, WETH9[1]])
      expect(result[1].outputAmount.currency).toEqual(ETHER)
    })
  })
})
