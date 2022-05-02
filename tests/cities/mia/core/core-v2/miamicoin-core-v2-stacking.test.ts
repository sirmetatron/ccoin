import { assertEquals, describe, TxReceipt, types, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { MiamiCoinCoreModelV2 } from "../../../../../models/cities/mia/miamicoin-core-v2.model.ts";
import { MiamiCoinTokenModelV2 } from "../../../../../models/cities/mia/miamicoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let coreV2: MiamiCoinCoreModelV2;
let tokenV2: MiamiCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  coreV2 = ctx.models.get(MiamiCoinCoreModelV2, "miamicoin-core-v2");
  tokenV2 = ctx.models.get(MiamiCoinTokenModelV2, "miamicoin-token-v2");
});

describe("[MiamiCoin Core v2]", () => {
  //////////////////////////////////////////////////
  // STACKING CONFIGURATION
  //////////////////////////////////////////////////
  describe("STACKING CONFIGURATION", () => {
    describe("get-first-stacks-block-in-reward-cycle()", () => {
      it("succeeds and returns the first block in the reward cycle", () => {
        // arrange
        const user = accounts.get("wallet_1")!;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(user),
        ]);
        const activationBlockHeight =
          setupBlock.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);
        // act
        const result1 = coreV2.getFirstStacksBlockInRewardCycle(0).result;
        const result2 = coreV2.getFirstStacksBlockInRewardCycle(1).result;
        const result3 = coreV2.getFirstStacksBlockInRewardCycle(2).result;
        // assert
        result1.expectUint(activationBlockHeight);
        result2.expectUint(activationBlockHeight + MiamiCoinCoreModelV2.REWARD_CYCLE_LENGTH);
        result3.expectUint(activationBlockHeight + MiamiCoinCoreModelV2.REWARD_CYCLE_LENGTH * 2);
      });
    });
    describe("get-entitled-stacking-reward()", () => {
      it("succeeds and returns 0 if user did not stack CityCoins", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const stackerId = 1;
        const targetCycle = 1;
        const amountTokens = 200;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY + 1
        );
        chain.mineEmptyBlock(MiamiCoinCoreModelV2.REWARD_CYCLE_LENGTH * 2);
        // act
        const result = coreV2.getStackingReward(stackerId, targetCycle).result;
        // assert
        result.expectUint(0);
      });
      it("succeeds and returns the correct amount of uSTX user can claim", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amountUstx = 1000;
        const stacker = accounts.get("wallet_2")!;
        const stackerId = 1;
        const targetCycle = 1;
        const amountTokens = 200;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([coreV2.stackTokens(amountTokens, 1, stacker)]);
        chain.mineEmptyBlock(MiamiCoinCoreModelV2.REWARD_CYCLE_LENGTH);
        chain.mineBlock([coreV2.mineTokens(amountUstx, miner)]);
        chain.mineEmptyBlock(MiamiCoinCoreModelV2.REWARD_CYCLE_LENGTH);
        // act
        const result = coreV2.getStackingReward(stackerId, targetCycle).result;
        // assert
        result.expectUint(amountUstx * 0.7);
      });
    });
  });

  //////////////////////////////////////////////////
  // STACKING ACTIONS
  //////////////////////////////////////////////////
  describe("STACKING ACTIONS", () => {
    describe("stack-tokens()", () => {
      it("fails with ERR_STACKING_NOT_AVAILABLE when stacking is not available", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 2;
        chain.mineBlock([tokenV2.testMint(amountTokens, stacker)]);

        // act
        const receipt = chain.mineBlock([
          coreV2.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModelV2.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("fails with ERR_CANNOT_STACK while trying to stack with lock period = 0", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 0;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModelV2.ErrCode.ERR_CANNOT_STACK);
      });

      it("fails with ERR_CANNOT_STACK while trying to stack with lock period > 32", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 200;
        const lockPeriod = 33;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModelV2.ErrCode.ERR_CANNOT_STACK);
      });

      it("fails with ERR_CANNOT_STACK while trying to stack with 0 tokens", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 0;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModelV2.ErrCode.ERR_CANNOT_STACK);
      });

      it("fails with ERR_FT_INSUFFICIENT_BALANCE while trying to stack with amount tokens > user balance", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.stackTokens(amountTokens + 1, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(MiamiCoinCoreModelV2.ErrCode.ERR_FT_INSUFFICIENT_BALANCE);
      });

      it("succeeds and emits one ft_transfer event to core contract", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const receipt = chain.mineBlock([
          coreV2.stackTokens(amountTokens, lockPeriod, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 2);
        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          stacker.address,
          coreV2.address,
          "miamicoin"
        );
      });

      it("succeeds when called more than once", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 5;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens * 3, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        const mineTokensTx = coreV2.stackTokens(
          amountTokens,
          lockPeriod,
          stacker
        );
        const receipts = chain.mineBlock([
          mineTokensTx,
          mineTokensTx,
          mineTokensTx,
        ]).receipts;

        // assert
        receipts.forEach((receipt: TxReceipt) => {
          receipt.result.expectOk().expectBool(true);
          assertEquals(receipt.events.length, 2);

          receipt.events.expectFungibleTokenTransferEvent(
            amountTokens,
            stacker.address,
            coreV2.address,
            "miamicoin"
          );
        });
      });

      it("succeeds and returns correct number of tokens when locking period = 1", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 1;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        chain.mineBlock([
          coreV2.stackTokens(amountTokens, lockPeriod, stacker),
        ]);

        // assert
        const rewardCycle = 1;
        const userId = 1;
        const result = coreV2.getStackerAtCycleOrDefault(
          rewardCycle,
          userId
        ).result;

        assertEquals(result.expectTuple(), {
          amountStacked: types.uint(amountTokens),
          toReturn: types.uint(amountTokens),
        });
      });

      it("succeeds and returns correct number of tokens when locking period > 1", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const amountTokens = 20;
        const lockPeriod = 8;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        chain.mineBlock([
          coreV2.stackTokens(amountTokens, lockPeriod, stacker),
        ]);

        // assert
        const userId = 1;

        for (let rewardCycle = 1; rewardCycle <= lockPeriod; rewardCycle++) {
          const result = coreV2.getStackerAtCycleOrDefault(
            rewardCycle,
            userId
          ).result;

          assertEquals(result.expectTuple(), {
            amountStacked: types.uint(amountTokens),
            toReturn: types.uint(rewardCycle === lockPeriod ? amountTokens : 0),
          });
        }
      });

      it("succeeds and returns correct number of tokens when stacking multiple times with different locking periods", () => {
        // arrange
        const stacker = accounts.get("wallet_2")!;
        const userId = 1;
        class StackingRecord {
          constructor(
            readonly stackInCycle: number,
            readonly lockPeriod: number,
            readonly amountTokens: number
          ) {}
        }

        const stackingRecords: StackingRecord[] = [
          new StackingRecord(1, 4, 20),
          new StackingRecord(3, 8, 432),
          new StackingRecord(7, 3, 10),
          new StackingRecord(8, 2, 15),
          new StackingRecord(9, 5, 123),
        ];

        const totalAmountTokens = stackingRecords.reduce(
          (sum, record) => sum + record.amountTokens,
          0
        );
        const maxCycle = Math.max.apply(
          Math,
          stackingRecords.map((record) => {
            return record.stackInCycle + 1 + record.lockPeriod;
          })
        );

        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(totalAmountTokens, stacker),
        ]);
        const activationBlockHeight =
          block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        // act
        stackingRecords.forEach((record) => {
          // move chain tip to the beginning of specific cycle
          chain.mineEmptyBlockUntil(
            activationBlockHeight +
              record.stackInCycle * MiamiCoinCoreModelV2.REWARD_CYCLE_LENGTH
          );

          chain.mineBlock([
            coreV2.stackTokens(
              record.amountTokens,
              record.lockPeriod,
              stacker
            ),
          ]);
        });

        // assert
        for (let rewardCycle = 0; rewardCycle <= maxCycle; rewardCycle++) {
          let expected = {
            amountStacked: 0,
            toReturn: 0,
          };

          stackingRecords.forEach((record) => {
            let firstCycle = record.stackInCycle + 1;
            let lastCycle = record.stackInCycle + record.lockPeriod;

            if (rewardCycle >= firstCycle && rewardCycle <= lastCycle) {
              expected.amountStacked += record.amountTokens;
            }

            if (rewardCycle == lastCycle) {
              expected.toReturn += record.amountTokens;
            }
          });

          const result = coreV2.getStackerAtCycleOrDefault(
            rewardCycle,
            userId
          ).result;

          console.table({
            cycle: rewardCycle,
            expected: expected,
            actual: result.expectTuple(),
          });

          assertEquals(result.expectTuple(), {
            amountStacked: types.uint(expected.amountStacked),
            toReturn: types.uint(expected.toReturn),
          });
        }
      });

      it("succeeds and prints tuple with firstCycle and lastCycle when stacked only in one cycle", () => {
        // arrange
        const stacker = accounts.get("wallet_7")!;
        const amountTokens = 20;
        const lockPeriod = 1;
        const stackDuringCycle = 3;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight = block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight + MiamiCoinCoreModelV2.REWARD_CYCLE_LENGTH * stackDuringCycle);

        // act
        const receipt = chain.mineBlock([coreV2.stackTokens(amountTokens, lockPeriod, stacker)]).receipts[0];

        // assert
        const firstCycle = stackDuringCycle + 1;
        const lastCycle = firstCycle + (lockPeriod - 1);
        const expectedPrintMsg = `{firstCycle: ${types.uint(firstCycle)}, lastCycle: ${types.uint(lastCycle)}}`;

        receipt.events.expectPrintEvent(coreV2.address, expectedPrintMsg);
      });

      it("succeeds and prints tuple with firstCycle and lastCycle when stacked in multiple cycles", () => {
        // arrange
        const stacker = accounts.get("wallet_7")!;
        const amountTokens = 20;
        const lockPeriod = 9;
        const stackDuringCycle = 8;
        const block = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        const activationBlockHeight = block.height + MiamiCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight + MiamiCoinCoreModelV2.REWARD_CYCLE_LENGTH * stackDuringCycle);

        // act
        const receipt = chain.mineBlock([coreV2.stackTokens(amountTokens, lockPeriod, stacker)]).receipts[0];

        // assert
        const firstCycle = stackDuringCycle + 1;
        const lastCycle = firstCycle + (lockPeriod - 1);
        const expectedPrintMsg = `{firstCycle: ${types.uint(firstCycle)}, lastCycle: ${types.uint(lastCycle)}}`;

        receipt.events.expectPrintEvent(coreV2.address, expectedPrintMsg);
      });
    });
  });
});

run();
