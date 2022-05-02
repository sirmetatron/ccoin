import { assertEquals, describe, run, Chain, beforeEach, it } from "../../../../../deps.ts";
import { Accounts, Context } from "../../../../../src/context.ts";
import { NewYorkCityCoinCoreModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-core-v2.model.ts";
import { NewYorkCityCoinTokenModelV2 } from "../../../../../models/cities/nyc/newyorkcitycoin-token-v2.model.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let coreV2: NewYorkCityCoinCoreModelV2;
let tokenV2: NewYorkCityCoinTokenModelV2;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  coreV2 = ctx.models.get(NewYorkCityCoinCoreModelV2, "newyorkcitycoin-core-v2");
  tokenV2 = ctx.models.get(NewYorkCityCoinTokenModelV2, "newyorkcitycoin-token-v2");
});

describe("[NewYorkCityCoin Core v2]", () => {
  //////////////////////////////////////////////////
  // STACKING CLAIMS
  //////////////////////////////////////////////////
  describe("STACKING CLAIMS", () => {
    describe("claim-stacking-reward()", () => {
      it("fails with ERR_STACKING_NOT_AVAILABLE when stacking is not yet available", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;

        // act
        const receipt = chain.mineBlock([
          coreV2.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("fails with ERR_USER_ID_NOT_FOUND when called by unknown user", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const otherUser = accounts.get("wallet_2")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(otherUser),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([
          coreV2.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_USER_ID_NOT_FOUND);
      });

      it("fails with ERR_REWARD_CYCLE_NOT_COMPLETED when reward cycle is not completed", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1
        );

        // act
        const receipt = chain.mineBlock([
          coreV2.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_REWARD_CYCLE_NOT_COMPLETED);
      });

      it("fails with ERR_NOTHING_TO_REDEEM when stacker didn't stack at all", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height +
            NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY +
            NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH * 2 -
            1
        );

        // act
        const receipt = chain.mineBlock([
          coreV2.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("fails with ERR_NOTHING_TO_REDEEM when stacker stacked in a cycle but miners did not mine", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const amount = 200;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amount, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([coreV2.stackTokens(amount, 4, stacker)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("fails with ERR_NOTHING_TO_REDEEM while trying to claim reward 2nd time", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const targetCycle = 1;
        const amount = 200;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amount, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([coreV2.stackTokens(amount, 1, stacker)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimStackingReward(targetCycle, stacker),
          coreV2.claimStackingReward(targetCycle, stacker),
        ]).receipts[1];

        // assert
        receipt.result
          .expectErr()
          .expectUint(NewYorkCityCoinCoreModelV2.ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("succeeds and emits stx_transfer and ft_transfer events", () => {
        // arrange
        const miner = accounts.get("wallet_1")!;
        const amountUstx = 1000;
        const stacker = accounts.get("wallet_2")!;
        const targetCycle = 1;
        const amountTokens = 200;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([coreV2.stackTokens(amountTokens, 1, stacker)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH);
        chain.mineBlock([coreV2.mineTokens(amountUstx, miner)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 2);

        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          coreV2.address,
          stacker.address,
          "newyorkcitycoin"
        );

        receipt.events.expectSTXTransferEvent(
          amountUstx * 0.7,
          coreV2.address,
          stacker.address
        );
      });

      it("succeeds and emits only a ft_transfer event when there was no STX reward (ie. due to no miners)", () => {
        // arrange
        const stacker = accounts.get("wallet_1")!;
        const amountTokens = 20;
        const targetCycle = 1;
        const setupBlock = chain.mineBlock([
          coreV2.testInitializeCore(coreV2.address),
          coreV2.testSetActivationThreshold(1),
          coreV2.registerUser(stacker),
          tokenV2.testMint(amountTokens, stacker),
        ]);
        chain.mineEmptyBlockUntil(
          setupBlock.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY + 1
        );
        chain.mineBlock([coreV2.stackTokens(amountTokens, 1, stacker)]);
        chain.mineEmptyBlock(NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH * 2);

        // act
        const receipt = chain.mineBlock([
          coreV2.claimStackingReward(targetCycle, stacker),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenTransferEvent(
          amountTokens,
          coreV2.address,
          stacker.address,
          "newyorkcitycoin"
        );
      });

      it("succeeds and returns tokens only for last cycle in locked period", () => {
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
          block.height + NewYorkCityCoinCoreModelV2.ACTIVATION_DELAY - 1;
        chain.mineEmptyBlockUntil(activationBlockHeight);

        stackingRecords.forEach((record) => {
          // move chain tip to the beginning of specific cycle
          chain.mineEmptyBlockUntil(
            activationBlockHeight +
              record.stackInCycle * NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH
          );

          chain.mineBlock([
            coreV2.stackTokens(
              record.amountTokens,
              record.lockPeriod,
              stacker
            ),
          ]);
        });

        chain.mineEmptyBlockUntil(
          NewYorkCityCoinCoreModelV2.REWARD_CYCLE_LENGTH * (maxCycle + 1)
        );

        // act + assert
        for (let rewardCycle = 0; rewardCycle <= maxCycle; rewardCycle++) {
          let toReturn = 0;

          stackingRecords.forEach((record) => {
            let lastCycle = record.stackInCycle + record.lockPeriod;

            if (rewardCycle == lastCycle) {
              toReturn += record.amountTokens;
            }
          });

          const receipt = chain.mineBlock([
            coreV2.claimStackingReward(rewardCycle, stacker),
          ]).receipts[0];

          if (toReturn === 0) {
            receipt.result.expectErr();
          } else {
            receipt.result.expectOk().expectBool(true);
            assertEquals(receipt.events.length, 1);

            receipt.events.expectFungibleTokenTransferEvent(
              toReturn,
              coreV2.address,
              stacker.address,
              "newyorkcitycoin"
            );
          }
        }
      });
    });
  });
});

run();
