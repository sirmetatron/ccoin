# Product Requirements Document

CityCoins on Stacks

Draft v0.1

April 2021

## Table of Contents

- [Product Requirements Document](#product-requirements-document)
  - [Table of Contents](#table-of-contents)
  - [General Information](#general-information)
    - [Contributors](#contributors)
    - [Executive Summary](#executive-summary)
    - [Objective, Vision and Goals](#objective-vision-and-goals)
    - [Purpose and Scope](#purpose-and-scope)
    - [Stakeholder Identification](#stakeholder-identification)
    - [Market Assessment and Target Demographics](#market-assessment-and-target-demographics)
  - [Core Functionality](#core-functionality)
    - [Mining](#mining)
    - [Stacking](#stacking)
    - [Trading and Open Markets](#trading-and-open-markets)
    - [Usability](#usability)
    - [Technical Requirements](#technical-requirements)
  - [Token Economics](#token-economics)
    - [Fair and Open Launch](#fair-and-open-launch)
    - [Issuance Schedule](#issuance-schedule)
    - [Citations](#citations)

## General Information

### Contributors

Jason Schrader, Devops Engineer at [Freehold](https://joinfreehold.com)

Shawn Mahon

[@asteriabtc](https://github.com/asteriabtc), founder of [Syvita Guild](https://github.com/syvita), `PGP | A303 BCFE CA30 DDF9`

### Executive Summary

The CityCoin will leverage the properties of the Proof of Transfer (PoX) consensus mechanism of the Stacks blockchain, programmed through a smart contract in Clarity, as a way to generate new funding and wealth building opportunities for the city, its inhabitants, and its supporters.

The CityCoin will not have its own blockchain, but rather will exist on the Stacks blockchain as a fungible token adhering to the SIP-010 standard. The Stacks blockchain is a layer one blockchain that settles on top of the Bitcoin blockchain, inheriting its security.

The CityCoin will not have an initial coin offering (ICO), but instead will be fairly mined in competition with anyone who wishes to interact with the contract, and following a diminishing issuance schedule similar to that of Bitcoin and Stacks. Mining of the CityCoin will not begin until the [activation threshold](#fair-and-open-launch) is reached.

When miners submit a transaction to the contract, 30% of the STX spent will be sent to the designated city's wallet overseen by a trusted third party custodian. The remaining 70% of the spent STX will be distributed to the CityCoin holders who lock their CityCoins in support of the initiative.

### Objective, Vision and Goals

**Objective:** to create a smart contract that simulates Proof of Transfer (PoX) to reward CityCoin holders and contribute to a general fund for the respective city

**Vision:** to signal support for a city is as simple as mining or buying the associated CityCoin, and holding the CityCoin generates revenue to both the CityCoin holders and the city itself

**Goal:** to enable a global market that can create a stronger, healthier, and more sustainable local economy

### Purpose and Scope

Starting with the two pilot cities of Miami and San Francisco, fairly launch a CityCoin for each that can be "mined" by spending Stacks tokens, as well as locked (or "Stacked") to generate yield in Stacks tokens.

As miners compete to mint new CityCoins, a portion of the Stacks tokens that miners spend are deposited into a custodied wallet on the Stacks blockchain, and available for the city leaders to take control of at any time.

There are no time restrictions for city leaders to take control of the funds, nor any usage restrictions for city leaders to decide how the funds should be spent.

This enables a global market in which participants can show support for a city while simultaneously contributing to its local economy.

### Stakeholder Identification

**City Leaders:** provide a new source of funding and encourage constituent participation in designated use of funds

**Citizens:** provide a method to invest directly in the city through mining of the CityCoin, purchase of the CityCoin, and holding/Stacking of the CityCoin

**Corporations:** provide a method to invest directly in the city through mining of the CityCoin, purchase of the CityCoin, and holding/Stacking of the CityCoin

**External Supporters:** provide a method to invest directly in the city through mining of the CityCoin, purchase of the CityCoin, and holding/Stacking of the CityCoin

### Market Assessment and Target Demographics

Bitcoin is finding utility on the balance sheet of several corporate treasuries as protection against monetary debasement and inflation, and local officials are looking into use cases for cryptocurrency, generally starting with Bitcoin.

For example, both Mayor Suarez of Miami and Mayor Conger of Tennessee are openly and publicly exploring Bitcoin mining as well as programs that allow citizens to pay for services in Bitcoin.

One challenge to mining or holding Bitcoin is that it does not produce yield, and market fluctuations can greatly affect the balance sheet. Mining Bitcoin is a competitive market dominated by large players, such that the capital requirement to start mining, the break-even point, and the power consumption are all considerations a city would need to resolve.

The Stacks blockchain is a Layer 1 blockchain connected to Bitcoin, in which miners spend Bitcoin to bid for and win a fixed amount of Stacks tokens. Stackers have the option to lock up Stacks tokens for a specified amount of time, and in turn, receive a portion of the Bitcoin yield that comes from miners proportionate to the amount Stacked. The average APY as of writing this document is 10% and additional statistics can be seen on [Stacking.Club](https://stacking.club).

Taking this concept a level further, a new token (the "CityCoin") could be created on the Stacks blockchain, following the SIP-010 fungible token standard, such that the CityCoins can be mined and Stacked per the methods stated above except a portion would be redirected to the city's wallet overseen by a trusted third party custodian.

## Core Functionality

### Mining

The act of mining a CityCoin is defined by someone sending Stacks tokens (STX) to the smart contract created for the city, using the following criteria.

- anyone can participate as a miner by sending Stacks tokens (STX) to the smart contract created for the city
- the Stacks tokens (STX) spent by miners will be distributed:
  - 70% to CityCoin holders who lock up their CityCoins through Stacking
  - 30% to the city's wallet overseen by a trusted third party custodian
- for each block in the Stacks blockchain, miners can mine a fixed amount of the CityCoin
  - the amount of CityCoins rewarded through mining will follow a diminishing [issuance schedule](#issuance-schedule)
- the winning miner for a given Stacks block is selected by a verifiable random function (VRF)
  - the VRF is weighted by the miner's STX bid compared to the total STX bid of other miners in a given Stacks block
  - after a maturity window (100 Stacks blocks), winning miners can claim the CityCoins as a reward at any time from the smart contract
- both the act of mining then claiming the CityCoin are required to increase the total supply of the CityCoins
  - unclaimed CityCoins are never minted, and do not affect the total supply

### Stacking

The act of Stacking a CityCoin is defined by someone sending the CityCoins to the smart contract created for the city, using the following criteria.

- anyone can participate as a Stacker by sending CityCoins to the smart contract created for the city
- a "reward cycle" is defined by the number of Stacks blocks the Stacker intends to lock their CityCoins for
  - if desired, Stackers can select to participate in more than one reward cycle
- Stackers will select the number of reward cycles to lock up the CityCoins when submitting their transaction to the smart contract
  - while locked, the CityCoins are held by the smart contract until the reward cycle passes
  - by locking the CityCoins, Stackers are eligible to receive a portion of the Stacks tokens (STX) spent by miners
  - the Stacks token (STX) rewards in a given reward cycle are determined by what fraction of CityCoins are locked up compared to all other Stackers in the same reward cycle
  - after the locking period, CityCoins are unlocked and Stackers can reclaim their CityCoins from the smart contract
  - after the locking period, if eligible, Stackers can claim their Stacks tokens (STX) rewards

In addition to the functions above, the Stacks token (STX) rewards can be Stacked again on the Stacks blockchain, yielding Bitcoin at 10% APY.

### Trading and Open Markets

The CityCoins will be listed and available for trading on centralized and decentralized exchanges.

### Usability

In consideration of enabling anyone to participate in mining or Stacking CityCoins, the following criteria will be implemented to interface with the smart contract.

**Note:** the average block times for the Stacks blockchain mirror that of the Bitcoin blockchain, at an average of 1 block every 10 minutes

**Mining**

A user interface for mining should be easy to configure, use and understand, such that:

- a miner can submit Stacks tokens (STX) to the contract using the Stacks Web Wallet
- a miner can choose to submit for one or multiple blocks at a given rate
- a miner can choose to stop mining if mining for multiple blocks at a given rate
- a miner can see available CityCoin rewards based on their address and claim them
- a miner can see current and historical mining statitistics, their mining activity, and their mining history
- all user data is stored in [Gaia](https://docs.stacks.co/build-apps/guides/data-storage), and only accessible to the user

**Stacking**

A user interface for Stacking should be easy to configure, use and understand, such that:

- a Stacker can obtain CityCoins through mining or purchasing them through an exchange
- a Stacker can submit CityCoins to the contract using the Stacks Web Wallet
- a Stacker can choose the number of reward cycles to participate in
- a Stacker can see the status of their CityCoins based on their address, and claim any that are unlocked from the smart contract
- a Stacker can see the available Stacks token (STX) rewards based on their address, and claim them from the smart contract
- a Stacker can see current and historical stacking statitistics, their stacking activity, and their stacking history
- all user data is stored in [Gaia](https://docs.stacks.co/build-apps/guides/data-storage), and only accessible to the user

**Statistics**

Additional performance metrics that may be of use to both the user interfaces above and/or a public-facing website are listed below, inspired by [stxmining.club](https://stxmining.club) and [stacking.club](https://stacking.club).

- current Bitcoin block and Stacks block
- current Bitcoin price, Stacks price, and CityCoin price in USD
- total market cap and trade value for the CityCoin
- total value of the city's wallet overseen by a trusted third party custodian
- when the city takes control of the city's wallet and associated funds
- total spent by miners of the CityCoin in a given Stacks block
- number of participating miners of the CityCoin in a given Stacks block
- number of wins for each miner, identified by Stacks address
- total spend for each miner, identified by Stacks address
- average spend for each miner, identified by Stacks address
- current reward cycle, date it started, and date estimated to end
- total value locked by Stackers of the CityCoin in a given reward cycle
- number of participating Stackers of the CityCoin in a given reward cycle
- total rewards and average slot rewards for Stackers in a given reward cycle

### Technical Requirements

**Smart Contract**

- the operations of mining and Stacking will be provided by the [CityCoin contract](./contracts/citycoin.clar)
- one copy of the contract code above will be created for each CityCoin, and published to mainnet
- the contract will be programmed using the [Clarity](https://clarity-lang.org) smart contract language

**Integrations**

- application integration with the Stacks blockchain will be provided by the [Stacks.js libraries](https://github.com/blockstack/stacks.js)
- user identity and transaction signing will be provided by the [Stacks Web Wallet](https://hiro.so/wallet/install-web)
- user data will be encrypted and stored in [Gaia](https://docs.stacks.co/build-apps/guides/data-storage)
- Stacks blockchain information will be provided by a [Stacks API Node](https://github.com/blockstack/stacks-blockchain-api)

## Token Economics

### Fair and Open Launch

The launch of a CityCoin will require at 20 unique wallets to signal activation as part of a function in the smart contract, after which a countdown begins and anyone is eligible to mine the CityCoins within a given Stacks block.

There are no CityCoins issued or distributed prior to the start of mining.

### Issuance Schedule

Miners receive coinbase rewards for mining the CityCoin outlined in the table below. The "halvings" occur at intervals similar to Bitcoin and Stacks, every 210,000 blocks, and there is a 10,000 block bonus reward for early miners.

The issuance schedule does not begin until mining is activated by miners, and once it begins, the current block height of the Stacks blockchain is recorded in the contract. From there, the issuance continues as follows:

| Time Period | Reward | Notes |
| --- | --- | --- |
| First 10,000 Stacks Blocks | 250,000 CityCoins | approx. 3 months |
| Next 200,000 Stacks Blocks | 100,000 CityCoins | approx. 4 years, minus bonus period |
| Next 210,000 Stacks Blocks | 50,000 CityCoins | approx. 4 years | 
| Next 210,000 Stacks Blocks | 25,000 CityCoins | approx. 4 years | 
| Next 210,000 Stacks Blocks | 12,500 CityCoins | approx. 4 years |
| Next 210,000 Stacks Blocks | 6,250 CityCoins | approx. 4 years |
| After 1,050,000 Stacks Blocks | 3,125 CityCoins | continues indefinitely |

After the final halving at 1,050,000 Stacks blocks past the Stacks block height recorded at activation, the total supply is estimated to be `42,187,500,000` and will increase indefinitely by `164,062,500` per year.

### Citations

- Coinkite Inc. (n.d.). Bitcoin Treasuries in Publicly Traded and Private Companies - List of large holders. Bitcoin Treasuries. Retrieved April 30, 2021, from https://bitcointreasuries.org/
- Corporate Finance Institute. (2020, July 17). Bitcoin Mining. https://corporatefinanceinstitute.com/resources/knowledge/other/bitcoin-mining/
- Crawley, J. (2021, March 29). Miami Mayor Wants City to Become Bitcoin Mining Hub. CoinDesk. https://www.coindesk.com/miami-mayor-wants-city-to-become-bitcoin-mining-hub
- Hood, C. (2021, April 23). Jackson, Tennessee, in ‘Prime Position’ to Be a Bitcoin Leader, Says Mayor. CoinDesk. https://www.coindesk.com/jackson-tennessee-bitcoin-mayor-scott-conger
- Nelson, D. (2020, November 10). MicroStrategy CEO Explains Why Bitcoin Is “a Million Times Better” Than “Antiquated” Gold. CoinDesk. https://www.coindesk.com/microstrategy-ceo-bitcoin-better-than-antiquated-gold
- Osmonson, T., & Stoever, H. (n.d.). Earn BTC by Stacking STX. Stacking.Club. Retrieved April 30, 2021, from https://stacking.club

Thank you to [Scribbr](https://www.scribbr.com/apa-citation-generator/) for making the APA citations much easier!
