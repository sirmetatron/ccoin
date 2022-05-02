;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; functions used only during testing
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(define-public (ft-mint (amount uint) (recipient principal))
  (ft-mint? citycoins amount recipient)
)

;; used to quickly simulate presence of 31 miners
(define-public (setup-31-miners (amount uint))
  (begin
    (try! (set-tokens-mined 'SP1GYBXAJSEF8SY0ERKA068J93E3EGNTXHR98MM5P block-height amount u0 u0))
    (try! (set-tokens-mined 'SP2M85H4NNNPQB0Y7GHT3K5EHWMRZWTHF2QAY1W69 block-height amount u0 u0))
    (try! (set-tokens-mined 'SP3A33QYJK76BCDJJD11RYWZP9D62PVQXK2VF5TJN block-height amount u0 u0))
    (try! (set-tokens-mined 'SP15Q4SMZ9CBY6KR3XVEJ37CPQ5J1BMXDQKTCMGY7 block-height amount u0 u0))
    (try! (set-tokens-mined 'SP25BWWBZSX1RMWFPN36MAHSV02242NTTV3SWST8C block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1NCBWJEB9FZMTP4KW3KPAK2T6XV34SJ9X5J8G7H block-height amount u0 u0))
    (try! (set-tokens-mined 'SP29XBE4RRPBBVSQMZWKRB0J1EEJNTH883X1Y4CBS block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1GY8PRRWDM87X61SKH411C9A67CBAV2G3P8JM3M block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1WD70BZ4RQ046JF4EYV0NS1NNFXH115PG0P570V block-height amount u0 u0))
    (try! (set-tokens-mined 'SPTWZTJ4PVS00X1PM7YEAXCAC64MQQ8EKSYWF1ZY block-height amount u0 u0))
    (try! (set-tokens-mined 'SPTWZTJ4PVS00X1PM7YEAXCAC64MQQ8EKSYWF1ZY block-height amount u0 u0))
    (try! (set-tokens-mined 'SP9BH35SH9HRT9M6EVTSM0A5V35MR4EZ55B35QEW block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1GC4CYYTWD516ZSC60CSBXCFWXYSP6GRJNVEP1S block-height amount u0 u0))
    (try! (set-tokens-mined 'SP20PT05Q35SR2HHEQ131SHSJ8339WWR75JMAN15K block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1KHGJZ6DVK29MXDNC8CH6SP9D3VQMD5DGDHWKNW block-height amount u0 u0))
    (try! (set-tokens-mined 'SPBGS5AACHW8M7W8QEKSBA3241TTBTK3JZ9Z36ZK block-height amount u0 u0))
    (try! (set-tokens-mined 'SP4MKYT1P8X8ZT2ECG6X9TWBBMHDZMYHHH529C0Q block-height amount u0 u0))
    (try! (set-tokens-mined 'SPGJM94X65H3DN49VEQRQQT454R4EBGGZ9DD880H block-height amount u0 u0))
    (try! (set-tokens-mined 'SP3AWJXN3R8JFSNWFCXR3HND5R0Z98271ESDJGJ9 block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1SKBHY382YBAM9YCZ384ZFC3ZRMS6MBM94EQZZV block-height amount u0 u0))
    (try! (set-tokens-mined 'SP3M5ND3J2JE820X8VZ0FP9TZYTJZRRQG7GX158WH block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1ZD2VXR93GN1JRPJFFDMTF13SKPZ4RDW8M5N7FH block-height amount u0 u0))
    (try! (set-tokens-mined 'SP26WS8W5ASCTQVWA2N873YXCXD2T5P9ZXFKMX7SM block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1FDCJNMK2H0XXN2PAGPSCEJBGP5DARKC1K1QMHR block-height amount u0 u0))
    (try! (set-tokens-mined 'SPT00VPT4EXCMMET7RPFRAHSA86CF6QCY2254J9Q block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1Z4RZ43E52G58DB17V1391BE1GMBJCEQFFNJJB8 block-height amount u0 u0))
    (try! (set-tokens-mined 'SP3SZ8MD3TXGP9WXK3MV6DJB1GQS6FBJ09FF9HP7M block-height amount u0 u0))
    (try! (set-tokens-mined 'SP2HYRZ84BK63B4VBBEBBP10ABXW2YPDRN4MXKE9Q block-height amount u0 u0))
    (try! (set-tokens-mined 'SP1NTQSMCKRN8MF30FEV6GH6F6M351ZHAE85ZQM55 block-height amount u0 u0))
    (try! (set-tokens-mined 'SP3E0K7RCVWF33RXPA1F22G4Y8TAHPP10RHYWXB2E block-height amount u0 u0))
    (try! (set-tokens-mined 'SPEKMXTCAEGD6AF1R7A2Q0H7VNKCP75VVC1AZQRQ block-height amount u0 u0))

    (ok true)
  )
)

(define-public (set-city-wallet (wallet-address principal))
  ;; specify city wallet address for testing, allows for a test wallet
  ;; to be used in place of specific city wallet defined in constant
  (begin
    (var-set city-wallet wallet-address)
    (ok true)
  )
)
