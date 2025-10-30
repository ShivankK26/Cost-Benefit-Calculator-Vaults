export function aprToPeriodRate(aprPercent: number, days: number): number {
	const apr = (aprPercent || 0) / 100;
	return apr * (days / 365);
}

export function interestCost(principal: number, aprPercent: number, days: number): number {
	return principal * aprToPeriodRate(aprPercent, days);
}

export type BorrowCostInputs = {
	principal: number;
	days: number;
	liquidityRate: number; // base borrow rate at LL
	stakingApr?: number; // reduces cost if negative? For borrow token, docs say rewards negative (rare); treat positive as fee adding to cost
	dexTradingApr?: number; // for smart debt, dex trading usually reduces cost (negative rewards), but spec says borrowRate.dex.trading is APR earned through swap fees; treat negative to cost
	vaultRateAdjust?: number; // positive = fee adds cost; negative = rewards reduce cost
};

export function totalBorrowApr(inputs: BorrowCostInputs): number {
	const { liquidityRate, stakingApr = 0, dexTradingApr = 0, vaultRateAdjust = 0 } = inputs;
	// For normal vault: total = liquidityRate adjusted by vaultRateAdjust in absolute percent (per docs rewardsOrFeeRateBorrow is relative to borrowRateLiquidity for normal). Simpler UI: show liquidityRate and apply vaultRateAdjust as absolute when provided by API.
	// For smart vault: all components are absolute APRs to be summed.
	return liquidityRate + stakingApr + dexTradingApr + vaultRateAdjust;
}

export function totalBorrowCost(inputs: BorrowCostInputs): number {
	const apr = totalBorrowApr(inputs);
	return interestCost(inputs.principal, apr, inputs.days);
}

export function benefitDifference(costNormal: number, costSmart: number): { benefit: number; percent: number } {
	const benefit = costNormal - costSmart;
	const percent = costNormal > 0 ? (benefit / costNormal) * 100 : 0;
	return { benefit, percent };
}


