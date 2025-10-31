export type ChainId = 1 | 8453 | 42161 | 137 | number;

const PROXY_BASE = "/api/fluid";

async function json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
	const res = await fetch(input, { ...init, cache: "no-store" });
	if (!res.ok) {
		throw new Error(`Fluid API error ${res.status}`);
	}
	return res.json();
	}

// Vaults list and detail
export async function listVaults(chainId: ChainId): Promise<any> {
	return json(`${PROXY_BASE}/v2/borrowing/${chainId}/vaults`);
}

export async function getVault(chainId: ChainId, vaultId: string | number): Promise<any> {
	return json(`${PROXY_BASE}/v2/borrowing/${chainId}/vaults/${vaultId}`);
}

// Smart lending reference (not directly used for debt comparison, but here for completeness)
export async function listSmartLendingTokens(chainId: ChainId): Promise<any> {
	return json(`${PROXY_BASE}/v2/smart-lending/${chainId}/tokens`);
}

export type BorrowRateBreakdown = {
	liquidityRate: number; // % APR absolute (e.g. 4 for 4%)
	stakingApr?: number; // % APR on token
	dexTradingApr?: number; // % APR from dex fees
	vaultRateAdjust?: number; // % APR absolute adjustment at vault
};

// Convert API rate from basis points to percentage
// Fluid Protocol API returns rates in basis points (100 = 1%)
// Example: "737" basis points = 7.37%, "435" basis points = 4.35%
// Values > 100 are definitely basis points, values <= 100 might be percentages but we'll be conservative
function normalizeRate(value: string | number | null | undefined): number {
	if (value == null || value === "") return 0;
	const num = typeof value === "string" ? parseFloat(value) : value;
	if (isNaN(num)) return 0;
	// If value is >= 100, it's definitely basis points (100 = 1%)
	// Values between 10-99: could be either, but most DeFi rates are < 20%, so treat as basis points if > 20
	// Values < 10: likely already percentages (e.g., 5 = 5%)
	if (num >= 100 || (num > 20 && num < 100)) {
		return num / 100; // Convert from basis points to percentage
	}
	return num; // Already a percentage
}

export function extractBorrowRateBreakdown(vault: any): BorrowRateBreakdown {
	// API normal vaults shape (per docs): borrowRate.liquidity, borrowRate.vault.feeRate or rewards, rewardsOrFeeRateBorrow etc.
	// Smart vaults: borrowRate.liquidity.token1, borrowToken.token1.stakingApr, borrowRate.dex.trading, borrowRate.vault.rate
	const isSmart = Boolean(vault?.borrowRate?.dex?.trading) || Boolean(vault?.borrowRate?.liquidity?.token1);
	if (isSmart) {
		return {
			liquidityRate: normalizeRate(vault?.borrowRate?.liquidity?.token1 ?? 0),
			stakingApr: normalizeRate(vault?.borrowToken?.token1?.stakingApr ?? 0),
			dexTradingApr: normalizeRate(vault?.borrowRate?.dex?.trading ?? 0),
			vaultRateAdjust: normalizeRate(vault?.borrowRate?.vault?.rate ?? 0),
		};
	}
	// Normal vault: rewardsOrFeeRateBorrow is RELATIVE to borrowRateLiquidity
	// For normal vaults, liquidity is in token0 (not token1)
	const liquidityRaw = vault?.borrowRate?.liquidity?.token0 ?? 
		vault?.borrowRate?.liquidity ?? 
		vault?.exchangePricesAndRates?.borrowRateLiquidity ?? 
		0;
	const liquidity = normalizeRate(liquidityRaw);
	
	const relative = Number(
		vault?.exchangePricesAndRates?.rewardsOrFeeRateBorrow ?? vault?.borrowRate?.vault?.relative ?? NaN
	);
	// If relative rate is provided, calculate absolute fee
	// Otherwise use vault.feeRate (which also needs normalization)
	const absoluteFee = !Number.isNaN(relative) 
		? (liquidity * relative) / 100 
		: normalizeRate(vault?.borrowRate?.vault?.feeRate ?? vault?.borrowRate?.vault?.rate ?? 0);
	
	return {
		liquidityRate: liquidity,
		vaultRateAdjust: absoluteFee,
	};
}

export function isSmartDebtVault(vault: any): boolean {
	// A smart debt vault has DEX trading on the borrow side OR has a valid token1 (indicating DEX pair)
	// Check for non-zero/non-null values to avoid false positives
	
	// Check for DEX trading APR (non-zero)
	const dexTrading = vault?.borrowRate?.dex?.trading;
	const hasDexTrading = dexTrading != null && 
		dexTrading !== "0" && 
		Number(dexTrading) !== 0;
	
	// Check for token1 in borrow token (smart vaults have a real token1 address, normal vaults have zero address)
	const token1Address = vault?.borrowToken?.token1?.address;
	const hasValidToken1 = token1Address != null && 
		token1Address !== "0x0000000000000000000000000000000000000000" &&
		token1Address !== "";
	
	// Check for token1 liquidity rate (should be non-zero for smart vaults)
	const token1Liquidity = vault?.borrowRate?.liquidity?.token1;
	const hasToken1Liquidity = token1Liquidity != null && 
		token1Liquidity !== "0" &&
		Number(token1Liquidity) !== 0;
	
	// A smart debt vault must have either DEX trading OR a valid token1 (not zero address)
	return hasDexTrading || (hasValidToken1 && hasToken1Liquidity);
}

export type VaultSummary = {
	id: string;
	name: string;
	isSmart: boolean;
	raw: any;
};

export async function listVaultSummaries(chainId: ChainId): Promise<VaultSummary[]> {
	const list = await listVaults(chainId);
	const items: any[] = Array.isArray(list?.vaults) ? list.vaults : Array.isArray(list) ? list : [];
	const ids: string[] = items
		.map((v: any) => String(v?.id ?? v?.vaultId ?? v?.address ?? ""))
		.filter((id: string) => id.length > 0);

	const detailResults = await Promise.allSettled(ids.map((id) => getVault(chainId, id)));

	return detailResults.map((res, idx) => {
		const fallbackId = ids[idx];
		if (res.status !== "fulfilled") {
			return { id: fallbackId, name: `Vault #${fallbackId}`, isSmart: false, raw: { id: fallbackId } };
		}
		const detail = res.value;
		const name = detail?.name || detail?.symbol || detail?.label || `Vault #${fallbackId}`;
		return { id: fallbackId, name, isSmart: isSmartDebtVault(detail), raw: detail };
	});
}


