import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_LOAN_AMOUNT = 101;
const ERR_INVALID_INTEREST_RATE = 102;
const ERR_INVALID_REPAYMENT_DURATION = 103;
const ERR_INSUFFICIENT_TRUST_SCORE = 104;
const ERR_LOAN_ALREADY_EXISTS = 105;
const ERR_LOAN_NOT_FOUND = 106;
const ERR_INVALID_TIMESTAMP = 107;
const ERR_INSUFFICIENT_POOL_FUNDS = 108;
const ERR_INVALID_COLLATERAL = 109;
const ERR_LOAN_NOT_DUE = 110;
const ERR_PAYMENT_EXCEEDS_DEBT = 111;
const ERR_INVALID_STATUS = 112;
const ERR_INVALID_BORROWER = 113;
const ERR_INVALID_LENDER = 114;
const ERR_MAX_LOANS_EXCEEDED = 115;
const ERR_INVALID_GRACE_PERIOD = 116;
const ERR_INVALID_PENALTY_RATE = 117;
const ERR_INVALID_CURRENCY = 118;
const ERR_INVALID_UPDATE_PARAM = 119;
const ERR_AUTHORITY_NOT_VERIFIED = 120;
const ERR_INVALID_MIN_SCORE = 121;
const ERR_INVALID_MAX_INTEREST = 122;
const ERR_INVALID_MIN_DURATION = 123;
const ERR_INVALID_MAX_DURATION = 124;

interface Loan {
  borrower: string;
  amount: number;
  interestRate: number;
  repaymentDuration: number;
  startTimestamp: number;
  gracePeriod: number;
  penaltyRate: number;
  currency: string;
  status: string;
  collateralAmount: number;
  repaidAmount: number;
  trustScoreAtIssuance: number;
  poolId: number;
}

interface LoanUpdate {
  updateAmount: number;
  updateInterestRate: number;
  updateRepaymentDuration: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class MicroFinanceMock {
  state: {
    nextLoanId: number;
    maxLoans: number;
    issuanceFee: number;
    minTrustScore: number;
    maxInterestRate: number;
    minRepaymentDuration: number;
    maxRepaymentDuration: number;
    authorityContract: string | null;
    loans: Map<number, Loan>;
    loanUpdates: Map<number, LoanUpdate>;
  } = {
    nextLoanId: 0,
    maxLoans: 10000,
    issuanceFee: 500,
    minTrustScore: 50,
    maxInterestRate: 15,
    minRepaymentDuration: 30,
    maxRepaymentDuration: 365,
    authorityContract: null,
    loans: new Map(),
    loanUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1BORROWER";
  authorities: Set<string> = new Set(["ST1BORROWER"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.state = {
      nextLoanId: 0,
      maxLoans: 10000,
      issuanceFee: 500,
      minTrustScore: 50,
      maxInterestRate: 15,
      minRepaymentDuration: 30,
      maxRepaymentDuration: 365,
      authorityContract: null,
      loans: new Map(),
      loanUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1BORROWER";
    this.authorities = new Set(["ST1BORROWER"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setIssuanceFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newFee < 0) return { ok: false, value: false };
    this.state.issuanceFee = newFee;
    return { ok: true, value: true };
  }

  setMinTrustScore(newScore: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newScore < 0) return { ok: false, value: false };
    this.state.minTrustScore = newScore;
    return { ok: true, value: true };
  }

  setMaxInterestRate(newRate: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (newRate <= 0) return { ok: false, value: false };
    this.state.maxInterestRate = newRate;
    return { ok: true, value: true };
  }

  setRepaymentDurationRange(minDuration: number, maxDuration: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (minDuration <= 0 || maxDuration < minDuration) return { ok: false, value: false };
    this.state.minRepaymentDuration = minDuration;
    this.state.maxRepaymentDuration = maxDuration;
    return { ok: true, value: true };
  }

  requestLoan(
    amount: number,
    interestRate: number,
    repaymentDuration: number,
    gracePeriod: number,
    penaltyRate: number,
    currency: string,
    collateralAmount: number,
    trustScore: number,
    poolId: number
  ): Result<number> {
    if (this.state.nextLoanId >= this.state.maxLoans) return { ok: false, value: ERR_MAX_LOANS_EXCEEDED };
    if (amount <= 0 || amount > 1000000) return { ok: false, value: ERR_INVALID_LOAN_AMOUNT };
    if (interestRate <= 0 || interestRate > this.state.maxInterestRate) return { ok: false, value: ERR_INVALID_INTEREST_RATE };
    if (repaymentDuration < this.state.minRepaymentDuration || repaymentDuration > this.state.maxRepaymentDuration) {
      return { ok: false, value: ERR_INVALID_REPAYMENT_DURATION };
    }
    if (trustScore < this.state.minTrustScore) return { ok: false, value: ERR_INSUFFICIENT_TRUST_SCORE };
    if (collateralAmount > 0 && collateralAmount < amount * 1.5) return { ok: false, value: ERR_INVALID_COLLATERAL };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (penaltyRate > 10) return { ok: false, value: ERR_INVALID_PENALTY_RATE };
    if (!["STX", "USD"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.state.loans.has(this.state.nextLoanId)) return { ok: false, value: ERR_LOAN_ALREADY_EXISTS };

    this.stxTransfers.push({ amount: this.state.issuanceFee, from: this.caller, to: this.state.authorityContract });

    const loanId = this.state.nextLoanId;
    const loan: Loan = {
      borrower: this.caller,
      amount,
      interestRate,
      repaymentDuration,
      startTimestamp: this.blockHeight,
      gracePeriod,
      penaltyRate,
      currency,
      status: "active",
      collateralAmount,
      repaidAmount: 0,
      trustScoreAtIssuance: trustScore,
      poolId,
    };
    this.state.loans.set(loanId, loan);
    this.state.nextLoanId++;
    return { ok: true, value: loanId };
  }

  repayLoan(loanId: number, paymentAmount: number): Result<boolean> {
    const loan = this.state.loans.get(loanId);
    if (!loan) return { ok: false, value: false };
    if (loan.borrower !== this.caller) return { ok: false, value: false };
    if (loan.status !== "active") return { ok: false, value: false };
    if (this.blockHeight < loan.startTimestamp + loan.gracePeriod) return { ok: false, value: false };
    const totalDue = loan.amount + (loan.amount * loan.interestRate) / 100;
    const newRepaidAmount = loan.repaidAmount + paymentAmount;
    if (newRepaidAmount > totalDue) return { ok: false, value: false };

    const updatedLoan: Loan = {
      ...loan,
      repaidAmount: newRepaidAmount,
      status: newRepaidAmount >= totalDue ? "repaid" : "active",
    };
    this.state.loans.set(loanId, updatedLoan);
    return { ok: true, value: true };
  }

  updateLoan(loanId: number, newAmount: number, newInterestRate: number, newRepaymentDuration: number): Result<boolean> {
    const loan = this.state.loans.get(loanId);
    if (!loan) return { ok: false, value: false };
    if (loan.borrower !== this.caller) return { ok: false, value: false };
    if (loan.status !== "active") return { ok: false, value: false };
    if (newAmount <= 0 || newAmount > 1000000) return { ok: false, value: false };
    if (newInterestRate <= 0 || newInterestRate > this.state.maxInterestRate) return { ok: false, value: false };
    if (newRepaymentDuration < this.state.minRepaymentDuration || newRepaymentDuration > this.state.maxRepaymentDuration) {
      return { ok: false, value: false };
    }

    const updatedLoan: Loan = {
      ...loan,
      amount: newAmount,
      interestRate: newInterestRate,
      repaymentDuration: newRepaymentDuration,
      startTimestamp: this.blockHeight,
    };
    this.state.loans.set(loanId, updatedLoan);
    this.state.loanUpdates.set(loanId, {
      updateAmount: newAmount,
      updateInterestRate: newInterestRate,
      updateRepaymentDuration: newRepaymentDuration,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getLoan(loanId: number): Loan | null {
    return this.state.loans.get(loanId) || null;
  }

  getLoanCount(): Result<number> {
    return { ok: true, value: this.state.nextLoanId };
  }
}

describe("MicroFinance", () => {
  let contract: MicroFinanceMock;

  beforeEach(() => {
    contract = new MicroFinanceMock();
    contract.reset();
  });

  it("requests a loan successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const loan = contract.getLoan(0);
    expect(loan?.borrower).toBe("ST1BORROWER");
    expect(loan?.amount).toBe(1000);
    expect(loan?.interestRate).toBe(5);
    expect(loan?.repaymentDuration).toBe(60);
    expect(loan?.gracePeriod).toBe(7);
    expect(loan?.penaltyRate).toBe(2);
    expect(loan?.currency).toBe("STX");
    expect(loan?.collateralAmount).toBe(1500);
    expect(loan?.trustScoreAtIssuance).toBe(75);
    expect(loan?.poolId).toBe(1);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1BORROWER", to: "ST2AUTH" }]);
  });

  it("rejects loan request with insufficient trust score", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 40, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_TRUST_SCORE);
  });

  it("rejects loan request with invalid amount", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.requestLoan(0, 5, 60, 7, 2, "STX", 0, 75, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_LOAN_AMOUNT);
  });

  it("rejects loan request with invalid currency", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.requestLoan(1000, 5, 60, 7, 2, "BTC", 1500, 75, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CURRENCY);
  });

  it("rejects loan request without authority contract", () => {
    const result = contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("repays loan successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    contract.blockHeight = 10;
    const result = contract.repayLoan(0, 1050);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const loan = contract.getLoan(0);
    expect(loan?.repaidAmount).toBe(1050);
    expect(loan?.status).toBe("repaid");
  });

  it("rejects repayment for non-existent loan", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.repayLoan(99, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects repayment by non-borrower", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    contract.caller = "ST3FAKE";
    contract.blockHeight = 10;
    const result = contract.repayLoan(0, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects repayment before grace period", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    contract.blockHeight = 5;
    const result = contract.repayLoan(0, 500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects repayment exceeding debt", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    contract.blockHeight = 10;
    const result = contract.repayLoan(0, 2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("updates loan successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    const result = contract.updateLoan(0, 2000, 10, 90);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const loan = contract.getLoan(0);
    expect(loan?.amount).toBe(2000);
    expect(loan?.interestRate).toBe(10);
    expect(loan?.repaymentDuration).toBe(90);
    const update = contract.state.loanUpdates.get(0);
    expect(update?.updateAmount).toBe(2000);
    expect(update?.updateInterestRate).toBe(10);
    expect(update?.updateRepaymentDuration).toBe(90);
  });

  it("rejects update for non-existent loan", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.updateLoan(99, 2000, 10, 90);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-borrower", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    contract.caller = "ST3FAKE";
    const result = contract.updateLoan(0, 2000, 10, 90);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets issuance fee successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.setIssuanceFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.issuanceFee).toBe(1000);
  });

  it("sets min trust score successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.setMinTrustScore(60);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.minTrustScore).toBe(60);
  });

  it("sets repayment duration range successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.setRepaymentDurationRange(15, 180);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.minRepaymentDuration).toBe(15);
    expect(contract.state.maxRepaymentDuration).toBe(180);
  });

  it("returns correct loan count", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.requestLoan(1000, 5, 60, 7, 2, "STX", 1500, 75, 1);
    contract.requestLoan(2000, 10, 90, 14, 3, "USD", 3000, 80, 2);
    const result = contract.getLoanCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("parses loan parameters with Clarity types", () => {
    const currency = stringUtf8CV("STX");
    const amount = uintCV(1000);
    const interestRate = uintCV(5);
    expect(currency.value).toBe("STX");
    expect(amount.value).toEqual(BigInt(1000));
    expect(interestRate.value).toEqual(BigInt(5));
  });
});