import {
  Tx,
  Chain,
  Account,
  types,
  assertEquals,
  beforeEach,
  describe,
  it,
} from "../deps.ts";

import {
  CityCoinClient,
  MinersList,
  MinedBlock,
  ErrCode,
  FIRST_STACKING_BLOCK,
  REWARD_CYCLE_LENGTH,
  MINING_ACTIVATION_DELAY,
  MINING_HALVING_BLOCKS,
  SPLIT_STACKER_PERCENTAGE,
  SPLIT_CITY_PERCENTAGE,
  TOKEN_REWARD_MATURITY,
} from "../src/logic-client.ts";
import { TokenClient } from "../src/token-client.ts";

describe("[CityCoin Logic]", () => {
  let chain: Chain;
  let accounts: Map<string, Account>;
  let client: CityCoinClient;
  let tokenClient: TokenClient;
  let deployer: Account;
  let wallet_1: Account;
  let wallet_2: Account;
  let wallet_3: Account;
  let wallet_4: Account;
  let wallet_5: Account;
  let wallet_6: Account;

  function setupCleanEnv() {
    (Deno as any).core.ops();
    let transactions: Array<Tx> = [];
    let result = JSON.parse(
      (Deno as any).core.opSync("setup_chain", {
        name: "citycoin",
        transactions: transactions,
      })
    );

    chain = new Chain(result["session_id"]);
    accounts = new Map();

    for (let account of result["accounts"]) {
      accounts.set(account.name, account);
    }

    deployer = accounts.get("deployer")!;
    wallet_1 = accounts.get("wallet_1")!;
    wallet_2 = accounts.get("wallet_2")!;
    wallet_3 = accounts.get("wallet_3")!;
    wallet_4 = accounts.get("wallet_4")!;
    wallet_5 = accounts.get("wallet_5")!;
    wallet_6 = accounts.get("wallet_6")!;

    client = new CityCoinClient("citycoin-logic-v1", chain, deployer);
    tokenClient = new TokenClient("citycoin-token", chain, deployer);
  }

  describe("Read Only:", () => {
    setupCleanEnv();

    describe("get-total-supply-ustx()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns 0 if nobody mined", () => {
        const result = client.getTotalSupplyUstx().result;

        result.expectOk().expectUint(0);
      });

      it("returns 0 if someone mined but stackers are not stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        // skip mining activation delay period
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([client.mineTokens(100, wallet_1)]);

        const result = client.getTotalSupplyUstx().result;

        result.expectOk().expectUint(0);
      });

      // returns 70% of commitment when stackers are stacking
      it("returns 100 * SPLIT_STACKER_PERCENTAGE if someone mined and stackers are stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const startStacksHeight = MINING_ACTIVATION_DELAY + 5;

        chain.mineBlock([
          tokenClient.ftMint(100, wallet_1),
          client.stackTokens(100, startStacksHeight, 1, wallet_1),
        ]);

        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH + 1);

        chain.mineBlock([client.mineTokens(100, wallet_1)]);

        const result = client.getTotalSupplyUstx().result;

        result.expectOk().expectUint(100 * SPLIT_STACKER_PERCENTAGE);
      });
    });

    describe("get-coinbase-amount()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns u0 if mining is not active", () => {
        // pass a non-existent block height
        // simulates transaction if mining not active
        const result = client.getCoinbaseAmount(1).result;

        result.expectUint(0);
      });

      it("returns correct coinbase amount based on Stacks block height", () => {
        // activate mining
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);

        // advance chain to block where mining is active
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const startHeight = block.block_height - 1;

        const testData = [
          { blockHeight: startHeight - 1, reward: 0 }, // prior to mining activation (no reward)
          { blockHeight: startHeight, reward: 250000 }, // at mining activation (bonus reward)
          { blockHeight: startHeight + 1, reward: 250000 }, // first block after mining activation block (bonus reward)
          { blockHeight: startHeight + 10000, reward: 250000 }, // 1000th block after mining activation block (last bonus reward)
          { blockHeight: startHeight + 10001, reward: 100000 }, // 1001st block after mining activation block (first standard reward)
          { blockHeight: startHeight + MINING_HALVING_BLOCKS, reward: 100000 }, // 1st halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS + 1,
            reward: 50000,
          }, // after 1st halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 2,
            reward: 50000,
          }, // 2nd halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 2 + 1,
            reward: 25000,
          }, // after 2nd halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 3,
            reward: 25000,
          }, // 3rd halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 3 + 1,
            reward: 12500,
          }, // after 3rd halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 4,
            reward: 12500,
          }, // 4th halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 4 + 1,
            reward: 6250,
          }, // after 4th halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 5,
            reward: 6250,
          }, // 5th halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 5 + 1,
            reward: 3125,
          }, // after 5th halving
          {
            blockHeight: startHeight + MINING_HALVING_BLOCKS * 5 + 1234,
            reward: 3125,
          }, // after 5th halving
        ];

        console.log(`\n  mining activated at block ${startHeight}`);

        testData.forEach((t) => {
          let result = client.getCoinbaseAmount(t.blockHeight).result;

          try {
            result.expectUint(t.reward);
            console.log(
              `  success at block ${t.blockHeight} with reward ${t.reward}`
            );
          } catch (error) {
            throw new Error(
              `Failed to return correct coinbase amount at block ${t.blockHeight}\n${error}`
            );
          }
        });
      });
    });

    describe("get-block-commit-total()", () => {
      setupCleanEnv();

      it("returns 0 when miners list is empty", () => {
        const result = client.getBlockCommitTotal(1).result;
        result.expectUint(0);
      });

      it("returns 100 when two miners commit 30 and 70", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2),
        ]);

        const result = client.getBlockCommitTotal(block.block_height).result;

        result.expectUint(100);
      });
    });

    describe("get-block-commit-to-stackers()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns 0 when miners list is empty", () => {
        const result = client.getBlockCommitToStackers(1).result;
        result.expectUint(0);
      });

      it("returns 0 when no stackers are stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2),
        ]);

        const result = client.getBlockCommitToStackers(
          block.block_height
        ).result;

        result.expectUint(0);
      });

      it("returns 100 * SPLIT_STACKER_PERCENTAGE when stackers are stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        // stack in cycle 1 while cycle 0 is active
        chain.mineBlock([
          tokenClient.ftMint(100, wallet_2),
          client.stackTokens(100, MINING_ACTIVATION_DELAY + 5, 1, wallet_2),
        ]);

        // progress into reward cycle 1
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine during cycle 1, which will be split
        const block = chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2),
        ]);

        // check that split stacker commit was stored correctly in map
        const result = client.getBlockCommitToStackers(block.height - 1).result;

        result.expectUint(100 * SPLIT_STACKER_PERCENTAGE);
      });
    });

    describe("get-block-commit-to-city()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns 0 when miners list is empty", () => {
        const result = client.getBlockCommitToCity(1).result;
        result.expectUint(0);
      });

      it("returns 100 when no stackers are stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2),
        ]);

        const result = client.getBlockCommitToCity(block.block_height).result;

        result.expectUint(100);
      });

      it("returns 100 * SPLIT_CITY_PERCENTAGE when stackers are stacking", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        // stack in cycle 1 while cycle 0 is active
        chain.mineBlock([
          tokenClient.ftMint(100, wallet_2),
          client.stackTokens(100, MINING_ACTIVATION_DELAY + 5, 1, wallet_2),
        ]);

        // progress into reward cycle 1
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine during cycle 1, which will be split
        const block = chain.mineBlock([
          client.mineTokens(30, wallet_1),
          client.mineTokens(70, wallet_2),
        ]);

        // check that split stacker commit was stored correctly in map
        const result = client.getBlockCommitToCity(block.height - 1).result;

        result.expectUint(100 * SPLIT_CITY_PERCENTAGE);
      });
    });

    describe("get-block-winner()", () => {
      it("selects the correct winner", () => {
        // TODO: review this test in more detail
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const miners = new MinersList();
        miners.push(
          { miner: wallet_1, minerId: 1, amountUstx: 1 },
          { miner: wallet_2, minerId: 2, amountUstx: 2 },
          { miner: wallet_3, minerId: 3, amountUstx: 3 }
        );

        chain.mineBlock([
          client.mineTokens(miners[0].amountUstx, miners[0].miner),
          client.mineTokens(miners[1].amountUstx, miners[1].miner),
          client.mineTokens(miners[2].amountUstx, miners[2].miner),
        ]);

        chain.mineEmptyBlock(500);

        const known_rnd_winners = [0, 1, 1, 2, 2, 2, 0, 1, 1, 2, 2, 2, 0];

        known_rnd_winners.forEach((e, i) => {
          let result = client.getBlockWinner(block.block_height, i).result;
          let winner = result.expectSome().expectTuple();
          let expectedWinner = miners.getFormatted(e);

          assertEquals(winner, expectedWinner);
        });
      });

      it("returns no winner if there are no miners", () => {
        const result = client.getBlockWinner(200, 0).result;

        result.expectNone();
      });
    });

    describe("has-mined()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns true if miner mined in selected block", () => {
        // activate mining
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);

        // advance chain to block where mining is active
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const blockHeight = block.block_height;

        chain.mineBlock([client.mineTokens(200, wallet_1)]);

        const result = client.hasMined(wallet_1, blockHeight).result;

        result.expectBool(true);
      });

      it("returns false if miner didn't mine in selected block", () => {
        const result = client.hasMined(wallet_2, 800).result;

        result.expectBool(false);
      });
    });

    describe("can-claim-tokens()", () => {
      beforeEach(() => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);
      });

      const miners = new MinersList();
      miners.push(
        { miner: wallet_1, minerId: 1, amountUstx: 1 },
        { miner: wallet_2, minerId: 2, amountUstx: 2 },
        { miner: wallet_3, minerId: 3, amountUstx: 3 }
      );

      let txs = new Array();
      miners.forEach((r) => {
        txs.push(client.mineTokens(r.amountUstx, r.miner));
      });

      const claimedBlock = new MinedBlock(3, 1, 1, true);
      const unclaimedBlock = new MinedBlock(3, 1, 1, false);
      const tokenRewardMaturity = 100;

      it("returns true if miners can claim", () => {
        // TODO: how to expand description here?
        let block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        chain.mineBlock(txs);

        const claimerStacksBlockHeight = block.block_height;
        const currentStacksBlock = block.block_height + tokenRewardMaturity + 1;

        const results = [
          client.canClaimTokens(
            wallet_1,
            claimerStacksBlockHeight,
            0,
            unclaimedBlock,
            currentStacksBlock
          ).result,
          client.canClaimTokens(
            wallet_2,
            claimerStacksBlockHeight,
            1,
            unclaimedBlock,
            currentStacksBlock
          ).result,
          client.canClaimTokens(
            wallet_2,
            claimerStacksBlockHeight,
            2,
            unclaimedBlock,
            currentStacksBlock
          ).result,
          client.canClaimTokens(
            wallet_3,
            claimerStacksBlockHeight,
            3,
            unclaimedBlock,
            currentStacksBlock
          ).result,
          client.canClaimTokens(
            wallet_3,
            claimerStacksBlockHeight,
            4,
            unclaimedBlock,
            currentStacksBlock
          ).result,
          client.canClaimTokens(
            wallet_3,
            claimerStacksBlockHeight,
            5,
            unclaimedBlock,
            currentStacksBlock
          ).result,
          client.canClaimTokens(
            wallet_1,
            claimerStacksBlockHeight,
            6,
            unclaimedBlock,
            currentStacksBlock
          ).result,
        ];

        results.forEach((result) => {
          result.expectOk().expectBool(true);
        });
      });

      it("throws ERR_MINER_ID_NOT_FOUND if miners ID not found", () => {
        let block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        chain.mineBlock(txs);

        const claimerStacksBlockHeight = block.block_height;
        const currentStacksBlock = block.block_height + tokenRewardMaturity + 1;

        const results = [
          client.canClaimTokens(
            wallet_4,
            claimerStacksBlockHeight,
            0,
            unclaimedBlock,
            currentStacksBlock
          ).result,
          client.canClaimTokens(
            wallet_5,
            claimerStacksBlockHeight,
            1,
            unclaimedBlock,
            currentStacksBlock
          ).result,
          client.canClaimTokens(
            wallet_6,
            claimerStacksBlockHeight,
            2,
            unclaimedBlock,
            currentStacksBlock
          ).result,
        ];

        results.forEach((result) => {
          result.expectErr().expectUint(ErrCode.ERR_MINER_ID_NOT_FOUND);
        });
      });

      it("throws ERR_IMMATURE_TOKEN_REWARD if maturity window has not passed", () => {
        const result = client.canClaimTokens(
          wallet_1,
          0,
          0,
          unclaimedBlock,
          tokenRewardMaturity
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_IMMATURE_TOKEN_REWARD);
      });

      it("throws ERR_ALREADY_CLAIMED if miner already claimed", () => {
        const currentStacksBlock = tokenRewardMaturity + 1;
        const result = client.canClaimTokens(
          wallet_1,
          0,
          0,
          claimedBlock,
          currentStacksBlock
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_ALREADY_CLAIMED);
      });
    });

    describe("can-mine-tokens()", () => {
      it("returns true if miner can mine", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
          client.generateMinerId(wallet_3),
        ]);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const minerId = client.getMinerIdNum(wallet_3);
        const result = client.canMineTokens(
          wallet_3,
          minerId,
          block.block_height,
          10
        ).result;

        result.expectOk().expectBool(true);
      });

      it("throws ERR_STACKING_NOT_AVAILABLE error if there is no active reward cycle", () => {
        setupCleanEnv();
        chain.mineBlock([client.generateMinerId(wallet_3)]);
        const minerId = client.getMinerIdNum(wallet_3);

        const result = client.canMineTokens(wallet_3, minerId, 0, 10).result;

        result.expectErr().expectUint(ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("throws ERR_ALREADY_MINED error if miner already mined in this block", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
          client.generateMinerId(wallet_1),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const block = chain.mineBlock([client.mineTokens(200, wallet_1)]);
        const minerId = client.getMinerIdNum(wallet_1);

        const result = client.canMineTokens(
          wallet_1,
          minerId,
          block.height - 1,
          10
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_ALREADY_MINED);
      });

      it("throws ERR_CANNOT_MINE error if miner commits 0 uSTX", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
          client.generateMinerId(wallet_3),
        ]);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const result = client.canMineTokens(
          wallet_3,
          1,
          block.block_height,
          0
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_CANNOT_MINE);
      });

      it("throws ERR_INSUFFICIENT_BALANCE error if miner commits more uSTX than they have", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
          client.generateMinerId(wallet_3),
        ]);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const minerId = client.getMinerId(wallet_3).result;

        const result = client.canMineTokens(
          wallet_3,
          1,
          block.block_height,
          wallet_3.balance + 1
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_INSUFFICIENT_BALANCE);
      });

      it("throws ERR_TOO_SMALL_COMMITMENT error if miners list is full and commits less than least-commitment in block", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
          client.generateMinerId(wallet_1),
        ]);

        const minerId = client.getMinerIdNum(wallet_1);
        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        // fill miners list with 128 fake miners with commitment as low as 2uSTX
        chain.mineBlock([
          Tx.contractCall(
            "test-utils",
            "setup-32-miners-1",
            [],
            deployer.address
          ),
          Tx.contractCall(
            "test-utils",
            "setup-32-miners-2",
            [],
            deployer.address
          ),
          Tx.contractCall(
            "test-utils",
            "setup-32-miners-3",
            [],
            deployer.address
          ),
          Tx.contractCall(
            "test-utils",
            "setup-32-miners-4",
            [],
            deployer.address
          ),
        ]);

        const result = client.canMineTokens(
          wallet_1,
          minerId,
          block.block_height,
          1
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_TOO_SMALL_COMMITMENT);
      });
    });

    describe("can-stack-tokens()", () => {
      it("returns true if stacker can stack", () => {
        setupCleanEnv();

        chain.mineBlock([
          tokenClient.ftMint(100, wallet_1),
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);

        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const nowStacksHeight = block.block_height;
        const startStacksHeight = block.block_height + 5;

        const result = client.canStackTokens(
          wallet_1,
          100,
          nowStacksHeight,
          startStacksHeight,
          1
        ).result;

        result.expectOk().expectBool(true);
      });

      it("throws ERR_CANNOT_STACK error if nowStacksHeight > startStacksHeight", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);

        const nowStacksHeight = MINING_ACTIVATION_DELAY + 5;
        const startStacksHeight = MINING_ACTIVATION_DELAY + 3;

        const result = client.canStackTokens(
          wallet_1,
          100,
          nowStacksHeight,
          startStacksHeight,
          1
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_CANNOT_STACK);
      });

      it("throws ERR_CANNOT_STACK error if lockPeriod=0 or lockPeriod > max-reward-cycles (32)", () => {
        const nowStacksHeight = 502;
        const startStacksHeight = 510;

        const results = [
          client.canStackTokens(
            wallet_1,
            100,
            nowStacksHeight,
            startStacksHeight,
            0
          ).result,
          client.canStackTokens(
            wallet_1,
            100,
            nowStacksHeight,
            startStacksHeight,
            33
          ).result,
        ];

        results.forEach((result) => {
          result.expectErr().expectUint(ErrCode.ERR_CANNOT_STACK);
        });
      });

      it("throws ERR_CANNOT_STACK error if amountToken = 0", () => {
        const nowStacksHeight = 502;
        const startStacksHeight = 510;
        const amountToken = 0;

        const result = client.canStackTokens(
          wallet_1,
          amountToken,
          nowStacksHeight,
          startStacksHeight,
          1
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_CANNOT_STACK);
      });

      it("throws ERR_INSUFFICIENT_BALANCE if stacker doesn't have enough tokens", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);

        const nowStacksHeight = MINING_ACTIVATION_DELAY + 5;
        const startStacksHeight = MINING_ACTIVATION_DELAY + 6;
        const amountToken = 100000;

        const result = client.canStackTokens(
          wallet_1,
          amountToken,
          nowStacksHeight,
          startStacksHeight,
          1
        ).result;

        result.expectErr().expectUint(ErrCode.ERR_INSUFFICIENT_BALANCE);
      });
    });

    describe("get-stacking-reward()", () => {
      it("returns u0 if before first reward cycle", () => {
        setupCleanEnv();
        const stacker = wallet_1;
        const targetRewardCycle = 0;
        const currentBlockHeight = 0;

        const result = client.getStackingReward(
          stacker,
          targetRewardCycle
        ).result;

        result.expectUint(0);
      });

      it("returns u0 if block height is in same reward cycle stacker stacked in", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const stacker = wallet_1;
        const miner = wallet_2;
        const minerCommitment = 1000;
        const targetRewardCycle = 1;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(5000, stacker),
          client.stackTokens(5000, 105, targetRewardCycle, stacker),
        ]);

        // move chain forward to jump into 1st stacking cycle (skip mining activation delay period)
        const block = chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([client.mineTokens(minerCommitment, miner)]);

        const result = client.getStackingReward(
          stacker,
          targetRewardCycle
        ).result;

        result.expectUint(0);
      });

      it("returns u0 if stacker did not contribute to this reward cycle", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const stacker = wallet_1;
        const miner = wallet_2;
        const nonStacker = wallet_3;
        const minerCommitment = 1000;
        const targetRewardCycle = 1;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(5000, stacker),
          client.stackTokens(5000, 105, targetRewardCycle, stacker),
        ]);

        // move chain forward to jump into 1st stacking cycle (skip mining activation delay period)
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([client.mineTokens(minerCommitment, miner)]);

        // move chain forward to jump into 2nd stacking cycle
        const block = chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const result = client.getStackingReward(
          nonStacker,
          targetRewardCycle
        ).result;

        result.expectUint(0);
      });

      it("returns correct value if miners committed 1000 uSTX and there is only one stacker", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const stacker = wallet_1;
        const miner = wallet_2;
        const minerCommitment = 1000;
        const targetRewardCycle = 1;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(5000, stacker),
          client.stackTokens(
            5000,
            MINING_ACTIVATION_DELAY + 5,
            targetRewardCycle,
            stacker
          ),
        ]);

        // move chain forward to jump into 1st stacking cycle (skip mining activation delay period)
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([client.mineTokens(minerCommitment, miner)]);

        // move chain forward to jump into 2nd stacking cycle
        const block = chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const result = client.getStackingReward(
          stacker,
          targetRewardCycle
        ).result;

        result.expectUint(minerCommitment * SPLIT_STACKER_PERCENTAGE);
      });

      it("returns correct value if miners committed 1000 uSTX and there are two stackers with equal stacking commitments", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const stackerOne = wallet_1;
        const stackerOneStacked = 5000;
        const stackerTwo = wallet_3;
        const stackerTwoStacked = 5000;
        const miner = wallet_2;
        const minerCommitment = 1000;
        const targetRewardCycle = 1;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(stackerOneStacked, stackerOne),
          tokenClient.ftMint(stackerTwoStacked, stackerTwo),
          client.stackTokens(
            stackerOneStacked,
            MINING_ACTIVATION_DELAY + 5,
            targetRewardCycle,
            stackerOne
          ),
          client.stackTokens(
            stackerTwoStacked,
            MINING_ACTIVATION_DELAY + 5,
            targetRewardCycle,
            stackerTwo
          ),
        ]);

        // move chain forward to jump into 1st stacking cycle (skip mining activation delay period)
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([client.mineTokens(minerCommitment, miner)]);

        // move chain forward to jump into 2nd stacking cycle
        const block = chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const resultOne = client.getStackingReward(
          stackerOne,
          targetRewardCycle
        ).result;
        const resultTwo = client.getStackingReward(
          stackerTwo,
          targetRewardCycle
        ).result;

        // (total-ustx * this-stackers-tokens) / total-tokens-stacked
        const resultOneAmt =
          (minerCommitment * SPLIT_STACKER_PERCENTAGE * stackerOneStacked) /
          (stackerOneStacked + stackerTwoStacked);
        const resultTwoAmt =
          (minerCommitment * SPLIT_STACKER_PERCENTAGE * stackerTwoStacked) /
          (stackerOneStacked + stackerTwoStacked);

        resultOne.expectUint(resultOneAmt);
        resultTwo.expectUint(resultTwoAmt);
      });

      it("returns correct value if miners committed 1000 uSTX and there are two stackers with unequal stacking commitments", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const stackerOne = wallet_1;
        const stackerOneStacked = 2500;
        const stackerTwo = wallet_3;
        const stackerTwoStacked = 7500;
        const miner = wallet_2;
        const minerCommitment = 1000;
        const targetRewardCycle = 1;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(stackerOneStacked, stackerOne),
          tokenClient.ftMint(stackerTwoStacked, stackerTwo),
          client.stackTokens(
            stackerOneStacked,
            MINING_ACTIVATION_DELAY + 5,
            targetRewardCycle,
            stackerOne
          ),
          client.stackTokens(
            stackerTwoStacked,
            MINING_ACTIVATION_DELAY + 5,
            targetRewardCycle,
            stackerTwo
          ),
        ]);

        // move chain forward to jump into 1st stacking cycle (skip mining activation delay period)
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([client.mineTokens(minerCommitment, miner)]);

        // move chain forward to jump into 2nd stacking cycle
        const block = chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const resultOne = client.getStackingReward(
          stackerOne,
          targetRewardCycle
        ).result;
        const resultTwo = client.getStackingReward(
          stackerTwo,
          targetRewardCycle
        ).result;

        // (total-ustx * this-stackers-tokens) / total-tokens-stacked
        const resultOneAmt =
          (minerCommitment * SPLIT_STACKER_PERCENTAGE * stackerOneStacked) /
          (stackerOneStacked + stackerTwoStacked);
        const resultTwoAmt =
          (minerCommitment * SPLIT_STACKER_PERCENTAGE * stackerTwoStacked) /
          (stackerOneStacked + stackerTwoStacked);

        resultOne.expectUint(resultOneAmt);
        resultTwo.expectUint(resultTwoAmt);
      });
    });

    describe("get-reward-cycle()", () => {
      it("returns None if stacksBlockHeight is equal 0", () => {
        const result = client.getRewardCycle(0).result;

        result.expectNone();
      });

      it("returns Some with correct value when stacksBlockHeight > MINING_ACTIVATION_DELAY", () => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);

        // starts after MINING_ACTIVATION_DELAY
        const blockHeights = [
          151, 155, 499, 500, 501, 1001, 1501, 1999, 2000, 2001,
        ];

        console.log(
          "\n  formula: (stacksBlockHeight - FIRST_STACKING_BLOCK) / REWARD_CYCLE_LENGTH)"
        );

        blockHeights.forEach((stacksBlockHeight) => {
          const expectedValue = Math.floor(
            (stacksBlockHeight - FIRST_STACKING_BLOCK) / REWARD_CYCLE_LENGTH
          );

          const result = client.getRewardCycle(stacksBlockHeight).result;

          console.log(
            `  success at block ${stacksBlockHeight} with reward cycle ${result}`
          );

          result.expectSome().expectUint(expectedValue);
        });
      });
    });

    describe("get-first-block-height-in-reward-cycle()", () => {
      it("returns correct value", () => {
        const rewardCycles = [0, 1, 2, 3, 5, 15, 24, 44, 890];

        console.log(
          "\n  formula: FIRST_STACKING_BLOCK + (REWARD_CYCLE_LENGTH * rewardCycle)"
        );

        rewardCycles.forEach((rewardCycle) => {
          const expectedValue =
            FIRST_STACKING_BLOCK + REWARD_CYCLE_LENGTH * rewardCycle;

          const result =
            client.getFirstBlockHeightInRewardCycle(rewardCycle).result;

          console.log(
            `  success at reward cycle ${rewardCycle} with block height ${result}`
          );

          result.expectUint(expectedValue);
        });
      });
    });

    describe("get-pox-lite-info()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("throws ERR_STACKING_NOT_AVAILABLE if stacking is not active", () => {
        const result = client.getPoxLiteInfo().result;

        result.expectErr().expectUint(ErrCode.ERR_STACKING_NOT_AVAILABLE);
      });

      it("returns statistics if stacking is active", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        // stack in cycle 1 while cycle 0 is active
        chain.mineBlock([
          tokenClient.ftMint(100, wallet_2),
          client.stackTokens(100, 105, 1, wallet_2),
        ]);

        // progress into reward cycle 1
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const result = client.getPoxLiteInfo().result;

        console.log(`\n  success returned: ${result}`);

        result.expectOk();
      });
    });

    describe("get-miner-id()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns none if no miners are registered", () => {
        const result = client.getMinerId(wallet_1).result;

        result.expectNone();
      });

      it("returns u1 if one miner registered", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const result = client.getMinerId(wallet_1).result;

        result.expectSome().expectUint(1);
      });
    });

    describe("get-mining-activation-status()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns false when mining activation threshold has not been reached", () => {
        const result = client.getMiningActivationStatus().result;

        result.expectBool(false);
      });

      it("returns true when mining activation threshold has been reached.", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const result = client.getMiningActivationStatus().result;

        result.expectBool(true);
      });
    });

    describe("get-registered-miners-threshold()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns 20 by default", () => {
        const result = client.getRegisteredMinersThreshold().result;

        result.expectUint(20);
      });

      it("returns value set by test add-on function", () => {
        const threshold = 5;

        chain.mineBlock([client.setMiningActivationThreshold(threshold)]);

        const result = client.getRegisteredMinersThreshold().result;

        result.expectUint(threshold);
      });
    });

    describe("get-registered-miners-nonce()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns 0 when no miner registered", () => {
        const result = client.getRegisteredMinersNonce().result;

        result.expectUint(0);
      });

      it("returns 3 when 3 miners registered", () => {
        chain.mineBlock([
          client.registerMiner(wallet_1),
          client.registerMiner(wallet_2),
          client.registerMiner(wallet_3),
        ]);

        const result = client.getRegisteredMinersNonce().result;
        result.expectUint(3);
      });

      it("returns 3 when 1 miner registered and 2 other mined block", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          client.mineTokens(200, wallet_2),
          client.mineTokens(250, wallet_3),
        ]);

        const result = client.getRegisteredMinersNonce().result;
        result.expectUint(3);
      });
    });

    describe("get-miners-at-block()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns empty list when no miners mined specific block", () => {
        const result = client.getMinersAtBlock(10).result;

        assertEquals(result.expectList().length, 0);
      });

      it("returns list with 3 miners when 3 miners mined block", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          client.mineTokens(100, wallet_1),
          client.mineTokens(200, wallet_2),
          client.mineTokens(300, wallet_3),
        ]);

        const result = client.getMinersAtBlock(block.block_height).result;
        const minersList = result.expectList();

        assertEquals(minersList.length, 3);
        // TODO: think about validating content of this list.
      });
    });

    describe("get-stacked-per-cycle()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns none when miner didn't stack in a cycle", () => {
        const result = client.getStackedPerCycle(wallet_1, 100).result;

        result.expectNone;
      });

      it("returns 200 stacked and 200 to return when miner stacked 200 tokens in 1 cycle", () => {
        const amount = 200;

        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
          tokenClient.ftMint(amount, wallet_1),
        ]);

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          client.stackTokens(amount, MINING_ACTIVATION_DELAY + 5, 1, wallet_1),
        ]);

        const result = client.getStackedPerCycle(wallet_1, 1).result;
        const expectedTuple = {
          "amount-token": types.uint(amount),
          "to-return": types.uint(amount),
        };

        assertEquals(result.expectSome().expectTuple(), expectedTuple);
      });
    });

    describe("get-tokens-per-cycle()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns 0 tokens and 0 ustx", () => {
        const result = client.getTokensPerCycle(1).result;

        const expectedTuple = {
          "total-tokens": types.uint(0),
          "total-ustx": types.uint(0),
        };

        const tuple = result.expectTuple();

        assertEquals(tuple, expectedTuple);
      });

      it("returns number of stacked tokens and committed uSTX", () => {
        const tokensAmount = 100;
        const ustxAmount = 1000;

        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
          tokenClient.ftMint(tokensAmount, wallet_1),
        ]);

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          client.stackTokens(
            tokensAmount,
            MINING_ACTIVATION_DELAY + 5,
            1,
            wallet_1
          ),
        ]);

        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);
        chain.mineBlock([client.mineTokens(ustxAmount, wallet_1)]);

        const expectedTuple = {
          "total-tokens": types.uint(tokensAmount),
          "total-ustx": types.uint(ustxAmount * SPLIT_STACKER_PERCENTAGE),
        };

        const result = client.getTokensPerCycle(1).result;
        const tuple = result.expectTuple();

        assertEquals(tuple, expectedTuple);
      });
    });

    describe("find-least-commitment()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("returns default tuple", () => {
        //stacks-block-height: stacks-block-height, least-commitment-idx: u0, least-commitment-ustx: u0
        const blockHeight = 10;

        const expectedTuple = {
          "stacks-block-height": types.uint(blockHeight),
          "least-commitment-idx": types.uint(0),
          "least-commitment-ustx": types.uint(0),
        };

        const result = client.findLeastCommitment(blockHeight).result;
        const tuple = result.expectTuple();

        assertEquals(tuple, expectedTuple);
      });

      it("returns miner if only one mined a block", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const blockHeight = block.block_height;

        chain.mineBlock([client.mineTokens(100, wallet_1)]);

        const expectedTuple = {
          "stacks-block-height": types.uint(blockHeight),
          "least-commitment-idx": types.uint(1),
          "least-commitment-ustx": types.uint(100),
        };

        const result = client.findLeastCommitment(blockHeight).result;
        const tuple = result.expectTuple();

        assertEquals(tuple, expectedTuple);
      });

      it("returns miner with smallest commitment at specific block", () => {
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const block = chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const blockHeight = block.block_height;

        chain.mineBlock([
          client.mineTokens(100, wallet_1),
          client.mineTokens(1, wallet_2),
          client.mineTokens(2000, wallet_3),
        ]);

        const expectedTuple = {
          "stacks-block-height": types.uint(blockHeight),
          "least-commitment-idx": types.uint(2),
          "least-commitment-ustx": types.uint(1),
        };

        const result = client.findLeastCommitment(blockHeight).result;
        const tuple = result.expectTuple();

        assertEquals(tuple, expectedTuple);
      });
    });
  });

  describe("Public:", () => {
    describe("stack-tokens()", () => {
      beforeEach(() => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
      });

      it("throws ERR_STACKING_NOT_AVAILABLE error", () => {
        const block = chain.mineBlock([
          client.stackTokens(100, 0, 1, wallet_1),
        ]);

        block.receipts[0].result
          .expectErr()
          .expectUint(ErrCode.ERR_STACKING_NOT_AVAILABLE);
        assertEquals(block.receipts[0].events.length, 0);
      });

      it("throws ERR_INSUFFICIENT_BALANCE error", () => {
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        const startStacksHeight = MINING_ACTIVATION_DELAY + 5;

        const block = chain.mineBlock([
          client.stackTokens(100, startStacksHeight, 1, wallet_1),
        ]);

        block.receipts[0].result
          .expectErr()
          .expectUint(ErrCode.ERR_INSUFFICIENT_BALANCE);
        assertEquals(block.receipts[0].events.length, 0);
      });

      it("succeeds and causes one ft_transfer_event", () => {
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const startStacksHeight = MINING_ACTIVATION_DELAY + 5;

        const block = chain.mineBlock([
          tokenClient.ftMint(100, wallet_1),
          client.stackTokens(100, startStacksHeight, 1, wallet_1),
        ]);

        // check return value
        block.receipts[1].result.expectOk().expectBool(true);

        // check number of events
        assertEquals(block.receipts[0].events.length, 1);

        // check events
        block.receipts[1].events.expectFungibleTokenTransferEvent(
          100,
          wallet_1.address,
          client.getContractAddress(),
          "citycoins"
        );
      });

      it("succeeds when called multiple times", () => {
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
        const startStacksHeight = MINING_ACTIVATION_DELAY + 5;

        chain.mineBlock([
          tokenClient.ftMint(1000, wallet_1),
          client.stackTokens(100, startStacksHeight, 1, wallet_1),
        ]);

        const block = chain.mineBlock([
          client.stackTokens(100, startStacksHeight, 1, wallet_1),
        ]);
        const result = client.getStackedPerCycle(wallet_1, 1).result;

        // check number of events
        assertEquals(block.receipts[0].events.length, 1);

        // check events
        block.receipts[0].events.expectFungibleTokenTransferEvent(
          100,
          wallet_1.address,
          client.getContractAddress(),
          "citycoins"
        );

        // check total amount of tokens stacked in cycle
        const expectedTuple = {
          "amount-token": types.uint(200),
          "to-return": types.uint(200),
        };

        assertEquals(result.expectSome().expectTuple(), expectedTuple);
      });

      it("remembers that tokens should be returned at the end of cycle when stacked for only one cycle", () => {
        const amount = 100;
        const startStacksHeight = MINING_ACTIVATION_DELAY + 5;

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          tokenClient.ftMint(amount, wallet_1),
          client.stackTokens(amount, startStacksHeight, 1, wallet_1),
        ]);

        const result = client.getStackedPerCycle(wallet_1, 1).result;

        const expectedTuple = {
          "amount-token": types.uint(amount),
          "to-return": types.uint(amount),
        };

        assertEquals(result.expectSome().expectTuple(), expectedTuple);
      });

      it("remembers tokens should be returned at the end of locking period when stacked for more than one cycle", () => {
        const amount = 100;
        const lockPeriod = 17;
        const startStacksHeight = MINING_ACTIVATION_DELAY + 5;

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          tokenClient.ftMint(amount, wallet_1),
          client.stackTokens(amount, startStacksHeight, lockPeriod, wallet_1),
        ]);

        for (let cycle = 1; cycle <= lockPeriod; cycle++) {
          let result = client.getStackedPerCycle(wallet_1, cycle).result;

          let expectedTuple = {
            "amount-token": types.uint(amount),
            "to-return": types.uint(cycle == lockPeriod ? amount : 0),
          };

          let actualTuple = result.expectSome().expectTuple();
        }
      });

      it("remembers tokens should be returned at the end of locking period when stacked multiple times for more than one cycle", () => {
        // in this test we stack 2x
        // 1) for 17 cycles
        // 2) for 11 cycles
        // both locking periods ends at the same time

        const amount_1 = 100;
        const amount_2 = 200;
        const totalAmount = amount_1 + amount_2;
        const lockPeriod_1 = 17;
        const lockPeriod_2 = 11;
        const startStacksHeight_1 = MINING_ACTIVATION_DELAY + 5;
        const startStacksHeight_2 =
          MINING_ACTIVATION_DELAY + 5 + REWARD_CYCLE_LENGTH * 6;

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          tokenClient.ftMint(totalAmount, wallet_1),
          client.stackTokens(
            amount_1,
            startStacksHeight_1,
            lockPeriod_1,
            wallet_1
          ),
          client.stackTokens(
            amount_2,
            startStacksHeight_2,
            lockPeriod_2,
            wallet_1
          ),
        ]);

        for (let cycle = 1; cycle <= lockPeriod_1; cycle++) {
          let result = client.getStackedPerCycle(wallet_1, cycle).result;

          let expectedTuple = {
            "amount-token": types.uint(cycle <= 6 ? amount_1 : totalAmount),
            "to-return": types.uint(cycle == lockPeriod_1 ? totalAmount : 0),
          };

          let actualTuple = result.expectSome().expectTuple();
          assertEquals(actualTuple, expectedTuple);
        }
      });

      it("remembers tokens should be returned at the end of each locking period when stacked multiple times", () => {
        const amount_1 = 10000;
        const amount_2 = 2500;
        const totalAmount = amount_1 + amount_2;
        const lockPeriod_1 = 1;
        const lockPeriod_2 = 15;
        const startStacksHeight = MINING_ACTIVATION_DELAY + 5;

        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);

        chain.mineBlock([
          tokenClient.ftMint(totalAmount, wallet_1),
          client.stackTokens(
            amount_1,
            startStacksHeight,
            lockPeriod_1,
            wallet_1
          ),
          client.stackTokens(
            amount_2,
            startStacksHeight,
            lockPeriod_2,
            wallet_1
          ),
        ]);

        for (let cycle = 1; cycle <= lockPeriod_2; cycle++) {
          let result = client.getStackedPerCycle(wallet_1, cycle).result;

          let amountToken: number;
          let toReturn: number;
          switch (cycle) {
            case lockPeriod_1:
              amountToken = totalAmount;
              toReturn = amount_1;
              break;

            case lockPeriod_2:
              amountToken = amount_2;
              toReturn = amount_2;
              break;

            default:
              amountToken = amount_2;
              toReturn = 0;
          }

          let expectedTuple = {
            "amount-token": types.uint(amountToken),
            "to-return": types.uint(toReturn),
          };

          let actualTuple = result.expectSome().expectTuple();
          assertEquals(actualTuple, expectedTuple);
        }
      });
    });

    describe("mine-tokens()", () => {
      beforeEach(() => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
      });

      it("throws ERR_CANNOT_MINE error when miner wants to commit 0 ustx", () => {
        const block = chain.mineBlock([client.mineTokens(0, wallet_1)]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_CANNOT_MINE);

        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_INSUFFICIENT_BALANCE error when miner wants to commit more than they have", () => {
        const block = chain.mineBlock([
          client.mineTokens(wallet_1.balance + 1, wallet_1),
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_INSUFFICIENT_BALANCE);

        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_ALREADY_MINED error when miner wants mine twice at the same block", () => {
        const block = chain.mineBlock([
          client.mineTokens(10, wallet_1),
          client.mineTokens(10, wallet_1),
        ]);

        const receipt_err = block.receipts[1];

        receipt_err.result.expectErr().expectUint(ErrCode.ERR_ALREADY_MINED);
        assertEquals(receipt_err.events.length, 0);
      });

      it("succeeds and causes one stx_transfer_event to city-wallet if no stackers stacking", () => {
        const amount = 20000;

        chain.mineBlock([client.setCityWalletUnsafe(wallet_6)]);

        const block = chain.mineBlock([client.mineTokens(amount, wallet_1)]);

        // check return value
        block.receipts[0].result.expectOk().expectBool(true);

        // check number of events
        assertEquals(block.receipts[0].events.length, 1);

        // check event details
        block.receipts[0].events.expectSTXTransferEvent(
          amount,
          wallet_1.address,
          wallet_6.address
        );
      });

      // modified to two events since 70% to stackers, 30% to city
      it("succeeds and causes two stx_transfer_events if stackers are stacking, one to stackers, one to city", () => {
        const amount = 20000;
        const startStacksHeight = MINING_ACTIVATION_DELAY + 5;

        chain.mineBlock([client.setCityWalletUnsafe(wallet_6)]);

        chain.mineBlock([
          tokenClient.ftMint(100, wallet_1),
          client.stackTokens(100, startStacksHeight, 1, wallet_1),
        ]);

        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH + 1);

        const block = chain.mineBlock([client.mineTokens(amount, wallet_1)]);

        // check return value
        block.receipts[0].result.expectOk().expectBool(true);

        // check number of events
        assertEquals(block.receipts[0].events.length, 2);

        // check event details
        const events = block.receipts[0].events;
        events.expectSTXTransferEvent(
          amount * SPLIT_STACKER_PERCENTAGE,
          wallet_1.address,
          client.getContractAddress()
        );
        events.expectSTXTransferEvent(
          amount * SPLIT_CITY_PERCENTAGE,
          wallet_1.address,
          wallet_6.address
        );
      });

      it("emits print event with memo if supplied", () => {
        chain.mineBlock([client.setCityWalletUnsafe(wallet_6)]);

        const memo = new TextEncoder().encode("hello world");

        const block = chain.mineBlock([client.mineTokens(200, wallet_1, memo)]);

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: client.getContractAddress(),
            topic: "print",
            value: types.some(types.buff(memo)),
          },
        };

        const receipt = block.receipts[0];
        assertEquals(receipt.events.length, 2);
        assertEquals(receipt.events[0], expectedEvent);
      });
    });

    describe("claim-stacking-reward()", () => {
      beforeEach(() => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
      });

      it("throws ERR_CYCLE_NOT_COMPLETED error when called in cycle 0", () => {
        const block = chain.mineBlock([
          client.claimStackingReward(0, wallet_1),
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_CYCLE_NOT_COMPLETED);
        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_CYCLE_NOT_COMPLETED error when called in cycle 1 during cycle 1", () => {
        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(5000, wallet_1),
          client.stackTokens(5000, 5, 1, wallet_1),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([client.mineTokens(50000, wallet_1)]);

        // try to claim
        const block = chain.mineBlock([
          client.claimStackingReward(1, wallet_1),
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_CYCLE_NOT_COMPLETED);
        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_NOTHING_TO_REDEEM error when stacker didn't stack at all", () => {
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const block = chain.mineBlock([
          client.claimStackingReward(0, wallet_1),
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_NOTHING_TO_REDEEM error when stacker want to redeem same reward second time", () => {
        const miner = wallet_1;
        const stacker = wallet_2;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(5000, stacker),
          client.stackTokens(5000, 5, 1, stacker),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([client.mineTokens(50000, miner)]);

        // advance chain forward to jump into 2nd stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // claim first time
        chain.mineBlock([client.claimStackingReward(1, stacker)]);

        // try to claim second time
        const block = chain.mineBlock([client.claimStackingReward(1, stacker)]);

        const receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_NOTHING_TO_REDEEM error when stacker stacked in a cycle but miners did not mine", () => {
        const stacker = wallet_3;
        const stackedAmount = 5000;

        // add tokens and stack them for multiple cycles
        chain.mineBlock([
          tokenClient.ftMint(stackedAmount, stacker),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            10,
            stacker
          ),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // skip mining tokens

        // advance chain forward to jump into 2nd stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const block = chain.mineBlock([client.claimStackingReward(1, stacker)]);
        const receipt = block.receipts[0];

        // check return value
        receipt.result.expectErr().expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
      });

      it("succeeds with mining active and causes one stx_transfer_event event and one ft_transfer event when user stacked for only one cycle", () => {
        const miner_1 = wallet_1;
        const miner_2 = wallet_2;
        const stacker = wallet_3;
        const minerCommitment = 2000;
        const stackedAmount = 5000;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(stackedAmount, stacker),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            1,
            stacker
          ),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([
          client.mineTokens(minerCommitment, miner_1),
          client.mineTokens(minerCommitment, miner_2),
        ]);

        // advance chain forward to jump into 2nd stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const block = chain.mineBlock([client.claimStackingReward(1, stacker)]);

        const receipt = block.receipts[0];

        // check return value
        receipt.result.expectOk().expectBool(true);

        // check events count
        assertEquals(receipt.events.length, 2);

        // check stx_transfer_event details
        receipt.events.expectSTXTransferEvent(
          minerCommitment * 2 * SPLIT_STACKER_PERCENTAGE,
          client.getContractAddress(),
          stacker.address
        );

        // check ft_transfer_event details
        receipt.events.expectFungibleTokenTransferEvent(
          stackedAmount,
          client.getContractAddress(),
          stacker.address,
          "citycoins"
        );
      });

      it("succeeds with no miners and causes one ft_transfer event when user stacked for only one cycle", () => {
        const stacker = wallet_3;
        const stackedAmount = 5000;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(stackedAmount, stacker),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            1,
            stacker
          ),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // advance chain forward to jump into 2nd stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const block = chain.mineBlock([client.claimStackingReward(1, stacker)]);

        const receipt = block.receipts[0];

        // check return value
        receipt.result.expectOk().expectBool(true);

        // check events count
        assertEquals(receipt.events.length, 1);

        // check ft_transfer_event details
        receipt.events.expectFungibleTokenTransferEvent(
          stackedAmount,
          client.getContractAddress(),
          stacker.address,
          "citycoins"
        );
      });

      it("succeeds with mining active and causes one stx_transfer_event when user stacked for multiple cycles and claimed before last cycle", () => {
        const miner_1 = wallet_1;
        const miner_2 = wallet_2;
        const stacker = wallet_3;
        const minerCommitment = 2000;
        const stackedAmount = 5000;

        // add tokens and stack them for multiple cycles
        chain.mineBlock([
          tokenClient.ftMint(stackedAmount, stacker),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            10,
            stacker
          ),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // mine some tokens
        chain.mineBlock([
          client.mineTokens(minerCommitment, miner_1),
          client.mineTokens(minerCommitment, miner_2),
        ]);

        // advance chain forward to jump into 2nd stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        const block = chain.mineBlock([client.claimStackingReward(1, stacker)]);

        const receipt = block.receipts[0];

        // check return value
        receipt.result.expectOk().expectBool(true);

        // check events count
        assertEquals(receipt.events.length, 1);

        // check stx_transfer_event details
        receipt.events.expectSTXTransferEvent(
          minerCommitment * 2 * SPLIT_STACKER_PERCENTAGE,
          client.getContractAddress(),
          stacker.address
        );
      });

      it("succeeds in releasing stacked tokens only for last cycle in locked period", () => {
        const stacker = wallet_2;
        const stackedAmount = 5000;
        const lockedPeriod = 28;

        // add tokens and stack them at the next cycle
        chain.mineBlock([
          tokenClient.ftMint(stackedAmount, stacker),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            lockedPeriod,
            stacker
          ),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        for (let cycle = 1; cycle <= lockedPeriod; cycle++) {
          // advance chain forward to jump into 2nd stacking cycle
          chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

          let block = chain.mineBlock([
            client.claimStackingReward(cycle, stacker),
          ]);

          let receipt = block.receipts[0];
          let expectedEventsCount = cycle == lockedPeriod ? 1 : 0;

          // check events count
          assertEquals(receipt.events.length, expectedEventsCount);

          if (cycle == lockedPeriod) {
            // check ft_transfer_event details
            receipt.events.expectFungibleTokenTransferEvent(
              stackedAmount,
              client.getContractAddress(),
              stacker.address,
              "citycoins"
            );
          } else {
            receipt.result
              .expectErr()
              .expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
          }
        }
      });

      it("succeeds in releasing stacked tokens only for last cycle in locked period if stacked multiple times", () => {
        const stacker = wallet_2;
        const stackedAmount = 5000;
        const lockedPeriod = 28;

        // add tokens and stack them in multiple cycles
        chain.mineBlock([
          tokenClient.ftMint(stackedAmount * 2, stacker),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            1,
            stacker
          ),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            lockedPeriod,
            stacker
          ),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        for (let cycle = 1; cycle <= lockedPeriod; cycle++) {
          chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

          let block = chain.mineBlock([
            client.claimStackingReward(cycle, stacker),
          ]);

          let receipt = block.receipts[0];
          let expectedEventsCount = cycle == 1 || cycle == lockedPeriod ? 1 : 0;

          // check events count
          assertEquals(receipt.events.length, expectedEventsCount);

          if (cycle == 1 || cycle == lockedPeriod) {
            // check ft_transfer_event details
            receipt.events.expectFungibleTokenTransferEvent(
              stackedAmount,
              client.getContractAddress(),
              stacker.address,
              "citycoins"
            );
          } else {
            receipt.result
              .expectErr()
              .expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
          }
        }
      });

      it("succeeds with correct number of events when stacker stacks for multiple cycles with or without miners active", () => {
        const miner = wallet_1;
        const stacker = wallet_2;
        const stackedAmount = 5000;
        const minerCommitment = 100;
        const firstLockedPeriod = 5;
        const secondLockedPeriod = 10;
        const thirdLockedPeriod = 28;

        // add tokens and stack them in multiple cycles
        chain.mineBlock([
          tokenClient.ftMint(stackedAmount * 3, stacker),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            firstLockedPeriod,
            stacker
          ),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            secondLockedPeriod,
            stacker
          ),
          client.stackTokens(
            stackedAmount,
            MINING_ACTIVATION_DELAY + 5,
            thirdLockedPeriod,
            stacker
          ),
        ]);

        // advance chain forward to jump into 1st stacking cycle
        chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

        // during first locking period, no miners are active
        // cycles 1-4: ERR_NOTHING_TO_REDEEM
        // cycle 5: returns stacked tokens

        for (let cycle = 1; cycle <= firstLockedPeriod; cycle++) {
          // advance into next reward cycle
          chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

          let block = chain.mineBlock([
            client.claimStackingReward(cycle, stacker),
          ]);
          let receipt = block.receipts[0];

          if (cycle == firstLockedPeriod) {
            console.log(
              `  Cycle ${cycle} of ${firstLockedPeriod}: one FT_TRANSFER event`
            );
            assertEquals(receipt.events.length, 1);
            // check ft_transfer_event details
            receipt.events.expectFungibleTokenTransferEvent(
              stackedAmount,
              client.getContractAddress(),
              stacker.address,
              "citycoins"
            );
          } else {
            console.log(
              `  Cycle ${cycle} of ${firstLockedPeriod}: ERR_NOTHING_TO_REDEEM`
            );
            receipt.result
              .expectErr()
              .expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
          }
        }

        // during second locking period, miners are active
        // cycles 6-9: returns STX reward
        // cycle 10: returns STX reward + stacked tokens

        for (
          let cycle = firstLockedPeriod + 1;
          cycle <= secondLockedPeriod;
          cycle++
        ) {
          chain.mineBlock([client.mineTokens(minerCommitment, miner)]);

          chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

          let block = chain.mineBlock([
            client.claimStackingReward(cycle, stacker),
          ]);

          let receipt = block.receipts[0];

          let expectedEventsCount = cycle == secondLockedPeriod ? 2 : 1;

          // check events count
          assertEquals(receipt.events.length, expectedEventsCount);

          // check stx_transfer_event details
          receipt.events.expectSTXTransferEvent(
            minerCommitment * SPLIT_STACKER_PERCENTAGE,
            client.getContractAddress(),
            stacker.address
          );

          if (cycle == secondLockedPeriod) {
            console.log(
              `  Cycle ${cycle} of ${secondLockedPeriod}: one STX_TRANSFER event and one FT_TRANSFER event`
            );
            receipt.events.expectFungibleTokenTransferEvent(
              stackedAmount,
              client.getContractAddress(),
              stacker.address,
              "citycoins"
            );
          } else {
            console.log(
              `  Cycle ${cycle} of ${secondLockedPeriod}: one STX_TRANSFER event`
            );
          }
        }

        // during third locking period, miners are active in some blocks
        // cycles 11-17: returns STX reward
        // cycle 18: ERR_NOTHING_TO_REDEEM
        // cycles 19-22: returns STX reward
        // cycle 23: ERR_NOTHING_TO_REDEEM
        // cycle 24-27: returns STX reward
        // cycle 28: returns STX reward  + stacked tokens

        for (
          let cycle = secondLockedPeriod + 1;
          cycle <= thirdLockedPeriod;
          cycle++
        ) {
          if (
            cycle != thirdLockedPeriod - firstLockedPeriod &&
            cycle != thirdLockedPeriod - secondLockedPeriod
          ) {
            // skip mining at cycle 18 and 23
            chain.mineBlock([client.mineTokens(minerCommitment, miner)]);
          }

          chain.mineEmptyBlock(REWARD_CYCLE_LENGTH);

          let block = chain.mineBlock([
            client.claimStackingReward(cycle, stacker),
          ]);

          let receipt = block.receipts[0];

          if (
            cycle == thirdLockedPeriod - firstLockedPeriod ||
            cycle == thirdLockedPeriod - secondLockedPeriod
          ) {
            console.log(
              `  Cycle ${cycle} of ${thirdLockedPeriod}: ERR_NOTHING_TO_REDEEM`
            );
            receipt.result
              .expectErr()
              .expectUint(ErrCode.ERR_NOTHING_TO_REDEEM);
          } else if (cycle == thirdLockedPeriod) {
            console.log(
              `  Cycle ${cycle} of ${thirdLockedPeriod}: one STX_TRANSFER event and one FT_TRANSFER event`
            );
            // check events count
            assertEquals(receipt.events.length, 2);
            // check stx_transfer_event details
            receipt.events.expectSTXTransferEvent(
              minerCommitment * SPLIT_STACKER_PERCENTAGE,
              client.getContractAddress(),
              stacker.address
            );
            // check ft_transfer_event details
            receipt.events.expectFungibleTokenTransferEvent(
              stackedAmount,
              client.getContractAddress(),
              stacker.address,
              "citycoins"
            );
          } else {
            console.log(
              `  Cycle ${cycle} of ${thirdLockedPeriod}: one STX_TRANSFER event`
            );
            // check events count
            assertEquals(receipt.events.length, 1);

            // check stx_transfer_event details
            receipt.events.expectSTXTransferEvent(
              minerCommitment * SPLIT_STACKER_PERCENTAGE,
              client.getContractAddress(),
              stacker.address
            );
          }
        }
      });
    });

    describe("register-miner()", () => {
      it("succeeds with (ok true)", () => {
        setupCleanEnv();

        const block = chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
        ]);

        const receipt = block.receipts[0];

        receipt.result.expectOk().expectBool(true);
        assertEquals(receipt.events.length, 0);
      });

      it("emits print event with memo if supplied", () => {
        setupCleanEnv();

        const memo = new TextEncoder().encode("hello world");

        const block = chain.mineBlock([client.registerMiner(wallet_1, memo)]);

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: client.getContractAddress(),
            topic: "print",
            value: types.some(types.buff(memo)),
          },
        };

        const receipt = block.receipts[0];
        assertEquals(receipt.events[0], expectedEvent);
      });

      it("doesn't emit any events if memo is not supplied", () => {
        setupCleanEnv();

        const block = chain.mineBlock([client.registerMiner(wallet_1)]);

        const events = block.receipts[0].events;

        assertEquals(events.length, 0);
      });

      it("throws ERR_MINER_ALREADY_REGISTERED error when miner wants to register second time", () => {
        setupCleanEnv();

        const block = chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
          client.registerMiner(wallet_1),
        ]);

        const receipt = block.receipts[2];

        receipt.result
          .expectErr()
          .expectUint(ErrCode.ERR_MINER_ALREADY_REGISTERED);
        assertEquals(receipt.events.length, 0);
      });

      it("throws ERR_MINING_ACTIVATION_THRESHOLD_REACHED error when miner wants to register after reaching activation threshold", () => {
        setupCleanEnv();

        const block = chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_1),
          client.registerMiner(wallet_2),
        ]);

        const receipt = block.receipts[2];

        receipt.result
          .expectErr()
          .expectUint(ErrCode.ERR_MINING_ACTIVATION_THRESHOLD_REACHED);
        assertEquals(receipt.events.length, 0);
      });
    });

    describe("set-city-wallet()", () => {
      beforeEach(() => {
        setupCleanEnv();
      });

      it("throws ERR_UNAUTHORIZED error when called by non city wallet", () => {
        const cityWallet = wallet_1;
        const newCityWallet = wallet_3;

        chain.mineBlock([client.setCityWalletUnsafe(cityWallet)]);

        const block = chain.mineBlock([
          client.setCityWallet(newCityWallet, newCityWallet),
        ]);

        const result = block.receipts[0].result;

        result.expectErr().expectUint(ErrCode.ERR_UNAUTHORIZED);
      });

      it("throws ERR_UNAUTHORIZED error when called via contract-call", () => {
        const cityWallet = wallet_1;

        chain.mineBlock([client.setCityWalletUnsafe(cityWallet)]);

        const block = chain.mineBlock([
          Tx.contractCall("test-malicious", "attack", [], wallet_1.address),
        ]);

        const result = block.receipts[0].result;

        result.expectErr().expectUint(ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and sets new city wallet, when called by previous city wallet", () => {
        const cityWallet = wallet_1;
        const newCityWallet = wallet_3;

        chain.mineBlock([client.setCityWalletUnsafe(cityWallet)]);

        const block = chain.mineBlock([
          client.setCityWallet(newCityWallet, cityWallet),
        ]);

        const blockResult = block.receipts[0].result;
        blockResult.expectOk().expectBool(true);

        const result = client.getCityWallet().result;
        result.expectPrincipal(newCityWallet.address);
      });

      it("succeeds and sets new city wallet, when called by contract that was a previous city wallet", () => {
        const cityWallet: Account = {
          name: "test-city-wallet",
          address: "ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.test-city-wallet",
          balance: 0,
          mnemonic: "unknown",
          derivation: "unknown",
        };
        const newCityWallet = wallet_3;

        chain.mineBlock([client.setCityWalletUnsafe(cityWallet)]);

        client
          .getCityWallet()
          .result.expectPrincipal(
            "ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.test-city-wallet"
          );

        const block = chain.mineBlock([
          Tx.contractCall(
            "test-city-wallet",
            "set-city-wallet",
            [types.principal(newCityWallet.address)],
            deployer.address
          ),
        ]);

        const receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);
      });
    });

    describe("claim-mining-reward()", () => {
      beforeEach(() => {
        setupCleanEnv();
        chain.mineBlock([
          client.setMiningActivationThreshold(1),
          client.registerMiner(wallet_3),
        ]);
        chain.mineEmptyBlock(MINING_ACTIVATION_DELAY);
      });

      it("throws ERR_IMMATURE_TOKEN_REWARD if maturity window has not passed", () => {
        const miner = wallet_1;

        let setupBlock = chain.mineBlock([client.mineTokens(100, miner)]);

        chain.mineEmptyBlock(1);

        let block = chain.mineBlock([
          client.claimMiningReward(setupBlock.height, miner),
        ]);

        let receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(ErrCode.ERR_IMMATURE_TOKEN_REWARD);
      });

      it("throws ERR_NO_WINNER if nobody mined at specific block", () => {
        chain.mineEmptyBlock(20000);

        let block = chain.mineBlock([client.claimMiningReward(5000, wallet_1)]);

        let receipt = block.receipts[0];

        receipt.result.expectErr().expectUint(ErrCode.ERR_NO_WINNER);
      });

      it("throws ERR_UNAUTHORIZED if main contract is not token trusted caller", () => {
        const miner = wallet_1;

        //mock contract account
        const contract: Account = {
          address: client.getContractAddress(),
          balance: 0,
          name: "contract",
          mnemonic: "",
          derivation: "",
        };

        let setupBlock = chain.mineBlock([
          client.mineTokens(100, miner),
          tokenClient.removeTrustedCaller(contract, deployer),
        ]);

        chain.mineEmptyBlock(TOKEN_REWARD_MATURITY);

        let block = chain.mineBlock([
          client.claimMiningReward(setupBlock.height - 1, miner),
        ]);

        let receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(TokenClient.ErrCode.ERR_UNAUTHORIZED);
      });

      it("succeeds and mint proper amount of citycoin tokens", () => {
        const miner = wallet_1;

        let setupBlock = chain.mineBlock([client.mineTokens(100, miner)]);

        chain.mineEmptyBlock(TOKEN_REWARD_MATURITY);

        let block = chain.mineBlock([
          client.claimMiningReward(setupBlock.height - 1, miner),
        ]);

        let receipt = block.receipts[0];

        receipt.result.expectOk().expectBool(true);
        receipt.events.expectFungibleTokenMintEvent(
          250000,
          miner.address,
          "citycoins"
        );
      });
    });
  });
});
