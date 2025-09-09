(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-LOAN-AMOUNT u101)
(define-constant ERR-INVALID-INTEREST-RATE u102)
(define-constant ERR-INVALID-REPAYMENT-DURATION u103)
(define-constant ERR-INSUFFICIENT-TRUST-SCORE u104)
(define-constant ERR-LOAN-ALREADY-EXISTS u105)
(define-constant ERR-LOAN-NOT-FOUND u106)
(define-constant ERR-INVALID-TIMESTAMP u107)
(define-constant ERR-INSUFFICIENT-POOL-FUNDS u108)
(define-constant ERR-INVALID-COLLATERAL u109)
(define-constant ERR-LOAN-NOT-DUE u110)
(define-constant ERR-PAYMENT-EXCEEDS-DEBT u111)
(define-constant ERR-INVALID-STATUS u112)
(define-constant ERR-INVALID-BORROWER u113)
(define-constant ERR-INVALID-LENDER u114)
(define-constant ERR-MAX-LOANS_EXCEEDED u115)
(define-constant ERR-INVALID-GRACE-PERIOD u116)
(define-constant ERR-INVALID-PENALTY-RATE u117)
(define-constant ERR-INVALID-CURRENCY u118)
(define-constant ERR-INVALID-UPDATE_PARAM u119)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u120)
(define-constant ERR-INVALID-MIN-SCORE u121)
(define-constant ERR-INVALID-MAX-INTEREST u122)
(define-constant ERR-INVALID-MIN-DURATION u123)
(define-constant ERR-INVALID-MAX-DURATION u124)
(define-constant ERR-LOAN-UPDATE-NOT-ALLOWED u125)

(define-data-var next-loan-id uint u0)
(define-data-var max-loans uint u10000)
(define-data-var issuance-fee uint u500)
(define-data-var min-trust-score uint u50)
(define-data-var max-interest-rate uint u15)
(define-data-var min-repayment-duration uint u30)
(define-data-var max-repayment-duration uint u365)
(define-data-var authority-contract (optional principal) none)

(define-map loans
  uint
  {
    borrower: principal,
    amount: uint,
    interest-rate: uint,
    repayment-duration: uint,
    start-timestamp: uint,
    grace-period: uint,
    penalty-rate: uint,
    currency: (string-utf8 20),
    status: (string-utf8 20),
    collateral-amount: uint,
    repaid-amount: uint,
    trust-score-at-issuance: uint,
    pool-id: uint
  }
)

(define-map loan-updates
  uint
  {
    update-amount: uint,
    update-interest-rate: uint,
    update-repayment-duration: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-loan (loan-id uint))
  (map-get? loans loan-id)
)

(define-read-only (get-loan-updates (loan-id uint))
  (map-get? loan-updates loan-id)
)

(define-read-only (get-loan-count)
  (ok (var-get next-loan-id))
)

(define-private (validate-loan-amount (amount uint))
  (if (and (> amount u0) (<= amount u1000000))
      (ok true)
      (err ERR-INVALID-LOAN-AMOUNT))
)

(define-private (validate-interest-rate (rate uint))
  (if (and (> rate u0) (<= rate (var-get max-interest-rate)))
      (ok true)
      (err ERR-INVALID-INTEREST-RATE))
)

(define-private (validate-repayment-duration (duration uint))
  (if (and (>= duration (var-get min-repayment-duration)) (<= duration (var-get max-repayment-duration)))
      (ok true)
      (err ERR-INVALID-REPAYMENT-DURATION))
)

(define-private (validate-trust-score (score uint))
  (if (>= score (var-get min-trust-score))
      (ok true)
      (err ERR-INSUFFICIENT-TRUST-SCORE))
)

(define-private (validate-collateral (collateral uint) (amount uint))
  (if (or (and (> collateral u0) (>= collateral (/ (* amount u150) u100))) (is-eq collateral u0))
      (ok true)
      (err ERR-INVALID-COLLATERAL))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-penalty-rate (rate uint))
  (if (<= rate u10)
      (ok true)
      (err ERR-INVALID-PENALTY-RATE))
)

(define-private (validate-currency (currency (string-utf8 20)))
  (if (or (is-eq currency u"STX") (is-eq currency u"USD"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-issuance-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set issuance-fee new-fee)
    (ok true)
  )
)

(define-public (set-min-trust-score (new-score uint))
  (begin
    (asserts! (>= new-score u0) (err ERR-INVALID-MIN-SCORE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set min-trust-score new-score)
    (ok true)
  )
)

(define-public (set-max-interest-rate (new-rate uint))
  (begin
    (asserts! (> new-rate u0) (err ERR-INVALID-MAX-INTEREST))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-interest-rate new-rate)
    (ok true)
  )
)

(define-public (set-repayment-duration-range (min-duration uint) (max-duration uint))
  (begin
    (asserts! (> min-duration u0) (err ERR-INVALID-MIN-DURATION))
    (asserts! (>= max-duration min-duration) (err ERR-INVALID-MAX-DURATION))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set min-repayment-duration min-duration)
    (var-set max-repayment-duration max-duration)
    (ok true)
  )
)

(define-public (request-loan
  (amount uint)
  (interest-rate uint)
  (repayment-duration uint)
  (grace-period uint)
  (penalty-rate uint)
  (currency (string-utf8 20))
  (collateral-amount uint)
  (trust-score uint)
  (pool-id uint)
)
  (let
    (
      (loan-id (var-get next-loan-id))
      (authority (var-get authority-contract))
    )
    (asserts! (< loan-id (var-get max-loans)) (err ERR-MAX-LOANS-EXCEEDED))
    (try! (validate-loan-amount amount))
    (try! (validate-interest-rate interest-rate))
    (try! (validate-repayment-duration repayment-duration))
    (try! (validate-trust-score trust-score))
    (try! (validate-collateral collateral-amount amount))
    (try! (validate-grace-period grace-period))
    (try! (validate-penalty-rate penalty-rate))
    (try! (validate-currency currency))
    (asserts! (is-none (get-loan loan-id)) (err ERR-LOAN-ALREADY-EXISTS))
    (asserts! (is-some authority) (err ERR-AUTHORITY-NOT-VERIFIED))
    (try! (stx-transfer? (var-get issuance-fee) tx-sender (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
    (map-set loans loan-id
      {
        borrower: tx-sender,
        amount: amount,
        interest-rate: interest-rate,
        repayment-duration: repayment-duration,
        start-timestamp: block-height,
        grace-period: grace-period,
        penalty-rate: penalty-rate,
        currency: currency,
        status: u"active",
        collateral-amount: collateral-amount,
        repaid-amount: u0,
        trust-score-at-issuance: trust-score,
        pool-id: pool-id
      }
    )
    (var-set next-loan-id (+ loan-id u1))
    (print { event: "loan-requested", id: loan-id })
    (ok loan-id)
  )
)

(define-public (repay-loan (loan-id uint) (payment-amount uint))
  (let
    (
      (loan (map-get? loans loan-id))
    )
    (match loan
      loan-data
        (begin
          (asserts! (is-eq (get borrower loan-data) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (is-eq (get status loan-data) u"active") (err ERR-INVALID-STATUS))
          (asserts! (>= block-height (+ (get start-timestamp loan-data) (get grace-period loan-data))) (err ERR-LOAN-NOT-DUE))
          (let
            (
              (total-due (+ (get amount loan-data) (/ (* (get amount loan-data) (get interest-rate loan-data)) u100)))
              (new-repaid-amount (+ (get repaid-amount loan-data) payment-amount))
            )
            (asserts! (<= new-repaid-amount total-due) (err ERR-PAYMENT-EXCEEDS-DEBT))
            (map-set loans loan-id
              {
                borrower: (get borrower loan-data),
                amount: (get amount loan-data),
                interest-rate: (get interest-rate loan-data),
                repayment-duration: (get repayment-duration loan-data),
                start-timestamp: (get start-timestamp loan-data),
                grace-period: (get grace-period loan-data),
                penalty-rate: (get penalty-rate loan-data),
                currency: (get currency loan-data),
                status: (if (>= new-repaid-amount total-due) u"repaid" u"active"),
                collateral-amount: (get collateral-amount loan-data),
                repaid-amount: new-repaid-amount,
                trust-score-at-issuance: (get trust-score-at-issuance loan-data),
                pool-id: (get pool-id loan-data)
              }
            )
            (print { event: "loan-repayment", id: loan-id, amount: payment-amount })
            (ok true)
          )
        )
      (err ERR-LOAN-NOT-FOUND)
    )
  )
)

(define-public (update-loan
  (loan-id uint)
  (new-amount uint)
  (new-interest-rate uint)
  (new-repayment-duration uint)
)
  (let
    (
      (loan (map-get? loans loan-id))
    )
    (match loan
      loan-data
        (begin
          (asserts! (is-eq (get borrower loan-data) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (is-eq (get status loan-data) u"active") (err ERR-INVALID-STATUS))
          (try! (validate-loan-amount new-amount))
          (try! (validate-interest-rate new-interest-rate))
          (try! (validate-repayment-duration new-repayment-duration))
          (map-set loans loan-id
            {
              borrower: (get borrower loan-data),
              amount: new-amount,
              interest-rate: new-interest-rate,
              repayment-duration: new-repayment-duration,
              start-timestamp: block-height,
              grace-period: (get grace-period loan-data),
              penalty-rate: (get penalty-rate loan-data),
              currency: (get currency loan-data),
              status: (get status loan-data),
              collateral-amount: (get collateral-amount loan-data),
              repaid-amount: (get repaid-amount loan-data),
              trust-score-at-issuance: (get trust-score-at-issuance loan-data),
              pool-id: (get pool-id loan-data)
            }
          )
          (map-set loan-updates loan-id
            {
              update-amount: new-amount,
              update-interest-rate: new-interest-rate,
              update-repayment-duration: new-repayment-duration,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "loan-updated", id: loan-id })
          (ok true)
        )
      (err ERR-LOAN-NOT-FOUND)
    )
  )
)