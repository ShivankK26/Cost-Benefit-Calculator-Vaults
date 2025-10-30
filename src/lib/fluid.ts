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

export function extractBorrowRateBreakdown(vault: any): BorrowRateBreakdown {
	// API normal vaults shape (per docs): borrowRate.liquidity, borrowRate.vault.feeRate or rewards, rewardsOrFeeRateBorrow etc.
	// Smart vaults: borrowRate.liquidity.token1, borrowToken.token1.stakingApr, borrowRate.dex.trading, borrowRate.vault.rate
	const isSmart = Boolean(vault?.borrowRate?.dex?.trading) || Boolean(vault?.borrowRate?.liquidity?.token1);
	if (isSmart) {
		return {
			liquidityRate: Number(vault?.borrowRate?.liquidity?.token1 ?? 0),
			stakingApr: Number(vault?.borrowToken?.token1?.stakingApr ?? 0),
			dexTradingApr: Number(vault?.borrowRate?.dex?.trading ?? 0),
			vaultRateAdjust: Number(vault?.borrowRate?.vault?.rate ?? 0),
		};
	}
	// Normal vault: rewardsOrFeeRateBorrow is RELATIVE to borrowRateLiquidity
	const liquidity = Number(
		vault?.borrowRate?.liquidity ?? vault?.exchangePricesAndRates?.borrowRateLiquidity ?? 0
	);
	const relative = Number(
		vault?.exchangePricesAndRates?.rewardsOrFeeRateBorrow ?? vault?.borrowRate?.vault?.relative ?? NaN
	);
	const absoluteFee = !Number.isNaN(relative) ? (liquidity * relative) / 100 : Number(vault?.borrowRate?.vault?.feeRate ?? 0);
	return {
		liquidityRate: liquidity,
		vaultRateAdjust: absoluteFee,
	};
}

export function isSmartDebtVault(vault: any): boolean {
	return Boolean(vault?.borrowRate?.dex?.trading) || Boolean(vault?.borrowRate?.liquidity?.token1);
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


