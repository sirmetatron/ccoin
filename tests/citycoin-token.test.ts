import { describe, assertEquals, types, Account, run, Chain, it, beforeEach} from "../deps.ts";
import { CoreModel } from "../models/core.model.ts";
import { SendManyRecord, TokenModel } from "../models/token.model.ts";
import { Accounts, Context } from "../src/context.ts";

let ctx: Context;
let chain: Chain;
let accounts: Accounts;
let token: TokenModel;
let core: CoreModel;

beforeEach(() => {
  ctx = new Context();
  chain = ctx.chain;
  accounts = ctx.accounts;
  token = ctx.models.get(TokenModel);
  core = ctx.models.get(CoreModel);
})


describe("[CityCoin Token]", () => {
  describe("SIP-010 FUNCTIONS", () => {
    describe("transfer()", () => {
      it("succeeds with no memo supplied", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_2")!;
        const amount = 100;

        chain.mineBlock([token.ftMint(amount, from)]);

        const block = chain.mineBlock([
          token.transfer(amount, from, to, from),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();
        block.receipts[0].events.expectFungibleTokenTransferEvent(
          amount,
          from.address,
          to.address,
          "citycoins"
        );
      });

      it("succeeds with memo supplied", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_2")!;
        const amount = 100;
        const memo = new TextEncoder().encode(
          "MiamiCoin is the first CityCoin"
        );

        chain.mineBlock([token.ftMint(amount, from)]);

        const block = chain.mineBlock([
          token.transfer(amount, from, to, from, memo),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();

        const expectedEvent = {
          type: "contract_event",
          contract_event: {
            contract_identifier: token.address,
            topic: "print",
            value: types.some(types.buff(memo)),
          },
        };

        const receipt = block.receipts[0];
        assertEquals(receipt.events.length, 2);
        assertEquals(receipt.events[0], expectedEvent);
        receipt.events.expectFungibleTokenTransferEvent(
          amount,
          from.address,
          to.address,
          "citycoins"
        );
      });

      it("fails with u1 when sender does not have enough funds", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_2")!;

        const block = chain.mineBlock([
          token.transfer(100, from, to, from),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(1);
      });

      it("fails with u2 when sender and recipient are the same", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_1")!;

        chain.mineBlock([token.ftMint(100, from)]);

        const block = chain.mineBlock([
          token.transfer(100, from, to, from),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectErr().expectUint(2);
      });

      it("fails with ERR_UNAUTHORIZED when token sender is different than transaction sender", () => {
        const from = accounts.get("wallet_1")!;
        const to = accounts.get("wallet_2")!;
        const sender = accounts.get("wallet_3")!;
        const amount = 100;

        chain.mineBlock([token.ftMint(amount, from)]);

        const block = chain.mineBlock([
          token.transfer(amount, from, to, sender),
        ]);

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result
          .expectErr()
          .expectUint(TokenModel.ErrCode.ERR_UNAUTHORIZED);
      });
    });

    describe("get-name()", () => {
      it("returns 'citycoins'", () => {
        const result = token.getName().result;

        result.expectOk().expectAscii("citycoins");
      });
    });

    describe("get-symbol()", () => {
      it("returns 'CYCN'", () => {
        const result = token.getSymbol().result;

        result.expectOk().expectAscii("CYCN");
      });
    });

    describe("get-decimals()", () => {
      it("returns 0", () => {
        const result = token.getDecimals().result;

        result.expectOk().expectUint(0);
      });
    });

    describe("get-balance()", () => {
      it("returns 0 when no tokens are minted", () => {
        const wallet_1 = accounts.get("wallet_1")!;
        const result = token.getBalance(wallet_1).result;

        result.expectOk().expectUint(0);
      });

      it("returns 100 after 100 tokens are minted to a wallet", () => {
        const wallet_1 = accounts.get("wallet_1")!;
        chain.mineBlock([token.ftMint(100, wallet_1)]);

        const result = token.getBalance(wallet_1).result;

        result.expectOk().expectUint(100);
      });
    });

    describe("get-total-supply()", () => {
      it("returns 0 when no tokens are minted", () => {
        const result = token.getTotalSupply().result;

        result.expectOk().expectUint(0);
      });

      it("returns 100 after 100 tokens are minted", () => {
        const wallet_1 = accounts.get("wallet_1")!;
        chain.mineBlock([token.ftMint(100, wallet_1)]);

        const result = token.getTotalSupply().result;

        result.expectOk().expectUint(100);
      });
    });
    describe("get-token-uri()", () => {
      it("returns correct uri", () => {
        const result = token.getTokenUri().result;
        const tokenUri = "https://cdn.citycoins.co/metadata/citycoin.json";

        console.log(`\n  URI: ${tokenUri}`);
        result.expectOk().expectSome().expectUtf8(tokenUri);
      });
    });

    describe("burn()", () => {
      it("throws ERR_UNAUTHORIZED when owner is different than transaction sender", () => {
        // arrange
        const owner = accounts.get("wallet_1")!;
        const sender = accounts.get("wallet_2")!;
        const amount = 500;

        // act
        const receipt = chain.mineBlock([token.burn(amount, owner, sender)])
          .receipts[0];

        // assert
        receipt.result
          .expectErr()
          .expectUint(TokenModel.ErrCode.ERR_UNAUTHORIZED);
      });

      it("fails when owner is trying to burn more tokens than he owns", () => {
        const owner = accounts.get("wallet_5")!;
        const amount = 8888912313;

        // act
        const receipt = chain.mineBlock([
          token.burn(amount, owner, owner),
        ]).receipts[0];

        receipt.result.expectErr().expectUint(1); // 1 is standard ft-burn error code
      })

      it("succeeds when called by tokens owner and burns correct amount of  tokens", () => {
        // arrange
        const owner = accounts.get("wallet_1")!;
        const amount = 300;
        chain.mineBlock([
          token.ftMint(amount, owner)
        ]);

        // act
        const receipt = chain.mineBlock([
          token.burn(amount, owner, owner),
        ]).receipts[0];

        // assert
        receipt.result.expectOk().expectBool(true);

        assertEquals(receipt.events.length, 1);

        receipt.events.expectFungibleTokenBurnEvent(
          amount,
          owner.address,
          "citycoins"
        );
      });
    });
  });

  describe("UTILITIES", () => {
    describe("mint()", () => {
      it("fails with ERR_CORE_CONTRACT_NOT_FOUND when called by someone who is not a trusted caller", () => {
        const wallet_2 = accounts.get("wallet_2")!;
        let block = chain.mineBlock([
          token.mint(200, wallet_2, wallet_2),
        ]);

        let receipt = block.receipts[0];

        receipt.result
          .expectErr()
          .expectUint(TokenModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });

      it("succeeds when called by trusted caller and mints requested amount of tokens", () => {
        const wallet_2 = accounts.get("wallet_2")!;
        const amount = 200;
        const recipient = accounts.get("wallet_3")!;

        chain.mineBlock([
          core.testInitializeCore(core.address),
        ]);

        let block = chain.mineBlock([
          core.testMint(amount, recipient, wallet_2),
        ]);

        let receipt = block.receipts[0];
        receipt.result.expectOk().expectBool(true);

        receipt.events.expectFungibleTokenMintEvent(
          amount,
          recipient.address,
          "citycoins"
        );
      });
    });
  });
  describe("TOKEN CONFIGURATION", () => {
    describe("activate-token()", () => {
      it("fails with ERR_UNAUTHORIZED if called by an unapproved sender", () => {
        const wallet_2 = accounts.get("wallet_2")!;
        const block = chain.mineBlock([
          token.activateToken(wallet_2, 10),
        ]);
        const receipt = block.receipts[0];
        receipt.result
          .expectErr()
          .expectUint(TokenModel.ErrCode.ERR_CORE_CONTRACT_NOT_FOUND);
      });
    });
  });

  describe("SEND-MANY", () => {
    describe("send-many()", () => {
      it("succeeds with five ft_transfer_events and five print memo events with memo supplied", () => {
        // arrange
        const from = accounts.get("wallet_1")!;

        const recipients: Array<Account> = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
          accounts.get("wallet_5")!,
          accounts.get("wallet_6")!,
        ];
        const amounts: Array<number> = [100, 200, 300, 400, 500];
        const memos: Array<ArrayBuffer> = [
          new TextEncoder().encode("MiamiCoin is the first CityCoin"),
          new TextEncoder().encode("The Capitol of Capital"),
          new TextEncoder().encode("Support your favorite cities"),
          new TextEncoder().encode("Revolutionizing Civic Engagement"),
          new TextEncoder().encode("Built on Stacks Secured by Bitcoin"),
        ];

        const sendManyRecords: SendManyRecord[] = [];

        recipients.forEach((recipient, recipientIdx) => {
          let record = new SendManyRecord(
            recipient,
            amounts[recipientIdx],
            memos[recipientIdx]
          );
          sendManyRecords.push(record);
        });

        const amountTotal = sendManyRecords.reduce(
          (sum, record) => sum + record.amount,
          0
        );

        // act

        chain.mineBlock([token.ftMint(amountTotal, from)]);

        const block = chain.mineBlock([
          token.sendMany(sendManyRecords, from),
        ]);

        // assert

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();

        const receipt = block.receipts[0];

        let sendManyIdx = 0;

        receipt.events.forEach((event, n) => {
          if (typeof sendManyRecords[sendManyIdx].memo !== "undefined") {
            receipt.events.expectPrintEvent(
              token.address,
              types.some(
                types.buff(<ArrayBuffer>sendManyRecords[sendManyIdx].memo)
              )
            );
          } else {
            receipt.events.expectFungibleTokenTransferEvent(
              sendManyRecords[sendManyIdx].amount,
              from.address,
              sendManyRecords[sendManyIdx].to.address,
              "citycoins"
            );
          }

          if (!(n % 2 == 0)) {
            sendManyIdx++;
          }
        });

        assertEquals(receipt.events.length, sendManyRecords.length * 2);
      });

      it("succeeds with five ft_transfer_events with no memo supplied", () => {
        // arrange
        const from = accounts.get("wallet_1")!;

        const recipients: Array<Account> = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
          accounts.get("wallet_5")!,
          accounts.get("wallet_6")!,
        ];
        const amounts: Array<number> = [100, 200, 300, 400, 500];

        const sendManyRecords: SendManyRecord[] = [];

        recipients.forEach((recipient, recipientIdx) => {
          let record = new SendManyRecord(recipient, amounts[recipientIdx]);
          sendManyRecords.push(record);
        });

        const amountTotal = sendManyRecords.reduce(
          (sum, record) => sum + record.amount,
          0
        );

        // act

        chain.mineBlock([token.ftMint(amountTotal, from)]);

        const block = chain.mineBlock([
          token.sendMany(sendManyRecords, from),
        ]);

        // assert

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();

        const receipt = block.receipts[0];

        let sendManyIdx = 0;

        receipt.events.forEach((event, n) => {
          if (typeof sendManyRecords[sendManyIdx].memo !== "undefined") {
            receipt.events.expectPrintEvent(
              token.address,
              types.some(
                types.buff(<ArrayBuffer>sendManyRecords[sendManyIdx].memo)
              )
            );
          } else {
            receipt.events.expectFungibleTokenTransferEvent(
              sendManyRecords[sendManyIdx].amount,
              from.address,
              sendManyRecords[sendManyIdx].to.address,
              "citycoins"
            );
          }

          if (!(n % 2 == 0)) {
            sendManyIdx++;
          }
        });

        assertEquals(receipt.events.length, sendManyRecords.length);
      });

      it("succeeds with five ft_transfer_events and two print events if memo supplied", () => {
        // arrange
        const from = accounts.get("wallet_1")!;

        const recipients: Array<Account> = [
          accounts.get("wallet_2")!,
          accounts.get("wallet_3")!,
          accounts.get("wallet_4")!,
          accounts.get("wallet_5")!,
          accounts.get("wallet_6")!,
        ];
        const amounts: Array<number> = [100, 200, 300, 400, 500];
        const memos: Array<ArrayBuffer> = [
          new TextEncoder().encode("MiamiCoin is the first CityCoin"),
          new TextEncoder().encode("Support your favorite cities"),
        ];

        const sendManyRecords: SendManyRecord[] = [];

        recipients.forEach((recipient, recipientIdx) => {
          let record = new SendManyRecord(
            recipient,
            amounts[recipientIdx],
            memos[recipientIdx]
          );
          sendManyRecords.push(record);
        });

        const amountTotal = sendManyRecords.reduce(
          (sum, record) => sum + record.amount,
          0
        );

        // act

        chain.mineBlock([token.ftMint(amountTotal, from)]);

        const block = chain.mineBlock([
          token.sendMany(sendManyRecords, from),
        ]);

        // assert

        assertEquals(block.receipts.length, 1);
        block.receipts[0].result.expectOk();

        const receipt = block.receipts[0];

        let sendManyIdx = 0;

        receipt.events.forEach((event, n) => {
          if (typeof sendManyRecords[sendManyIdx].memo !== "undefined") {
            receipt.events.expectPrintEvent(
              token.address,
              types.some(
                types.buff(<ArrayBuffer>sendManyRecords[sendManyIdx].memo)
              )
            );
          } else {
            receipt.events.expectFungibleTokenTransferEvent(
              sendManyRecords[sendManyIdx].amount,
              from.address,
              sendManyRecords[sendManyIdx].to.address,
              "citycoins"
            );
          }

          if (!(n % 2 == 0)) {
            sendManyIdx++;
          }
        });

        assertEquals(
          receipt.events.length,
          sendManyRecords.length + memos.length
        );
      });
    });
  });
});

//////////////////////////////////////////////////
// expectPrintEvent()
//////////////////////////////////////////////////

declare global {
  interface Array<T> {
    expectPrintEvent(contract_identifier: string, value: string): Object;
  }
}

Array.prototype.expectPrintEvent = function (
  contract_identifier: string,
  value: string
) {
  for (let event of this) {
    try {
      let e: any = {};
      e["contract_identifier"] =
        event.contract_event.contract_identifier.expectPrincipal(
          contract_identifier
        );

      if (event.contract_event.topic.endsWith("print")) {
        e["topic"] = event.contract_event.topic;
      } else {
        continue;
      }

      if (event.contract_event.value.endsWith(value)) {
        e["value"] = event.contract_event.value;
      } else {
        continue;
      }
      return e;
    } catch (error) {
      continue;
    }
  }
  throw new Error(`Unable to retrieve expected PrintEvent`);
};

run();