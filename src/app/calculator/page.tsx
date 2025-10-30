"use client";

import { useEffect, useMemo, useState } from "react";
import { listVaultSummaries, getVault, extractBorrowRateBreakdown, isSmartDebtVault, ChainId } from "@/lib/fluid";
import { totalBorrowApr, totalBorrowCost, benefitDifference } from "@/lib/calc";

type VaultOption = { id: string; name: string; raw: any; isSmart: boolean };

const CHAINS: { id: ChainId; name: string }[] = [
	{ id: 1, name: "Ethereum" },
	{ id: 8453, name: "Base" },
	{ id: 42161, name: "Arbitrum" },
];

export default function CalculatorPage() {
	const [chainId, setChainId] = useState<ChainId>(1);
	const [vaults, setVaults] = useState<VaultOption[]>([]);
	const [normalVaultId, setNormalVaultId] = useState<string>("");
	const [smartVaultId, setSmartVaultId] = useState<string>("");
	const [borrowAmount, setBorrowAmount] = useState<number>(10000);
	const [days, setDays] = useState<number>(30);
	const [normalDetail, setNormalDetail] = useState<any>(null);
	const [smartDetail, setSmartDetail] = useState<any>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		let mounted = true;
		setLoading(true);
		setError("");
    listVaultSummaries(chainId)
            .then((items) => {
                if (!mounted) return;
                const opts: VaultOption[] = items.map((v) => ({ id: v.id, name: v.name, raw: v.raw, isSmart: v.isSmart }));
                setVaults(opts);
				setNormalVaultId("");
				setSmartVaultId("");
				setNormalDetail(null);
				setSmartDetail(null);
			})
			.catch((e) => setError(e.message || "Failed to load vaults"))
			.finally(() => setLoading(false));
		return () => {
			mounted = false;
		};
	}, [chainId]);

	useEffect(() => {
		if (!normalVaultId) {
			setNormalDetail(null);
			return;
		}
		getVault(chainId, normalVaultId)
			.then(setNormalDetail)
			.catch(() => setNormalDetail(null));
	}, [chainId, normalVaultId]);

	useEffect(() => {
		if (!smartVaultId) {
			setSmartDetail(null);
			return;
		}
		getVault(chainId, smartVaultId)
			.then(setSmartDetail)
			.catch(() => setSmartDetail(null));
	}, [chainId, smartVaultId]);

	const normalBorrowApr = useMemo(() => {
		if (!normalDetail) return 0;
		const b = extractBorrowRateBreakdown(normalDetail);
		return totalBorrowApr({ principal: borrowAmount, days, ...b });
	}, [normalDetail, borrowAmount, days]);

	const smartBorrowApr = useMemo(() => {
		if (!smartDetail) return 0;
		const b = extractBorrowRateBreakdown(smartDetail);
		return totalBorrowApr({ principal: borrowAmount, days, ...b });
	}, [smartDetail, borrowAmount, days]);

	const costs = useMemo(() => {
		const normalBreakdown = normalDetail ? extractBorrowRateBreakdown(normalDetail) : undefined;
		const smartBreakdown = smartDetail ? extractBorrowRateBreakdown(smartDetail) : undefined;
		const normalCost = normalBreakdown
			? totalBorrowCost({ principal: borrowAmount, days, ...normalBreakdown })
			: 0;
		const smartCost = smartBreakdown
			? totalBorrowCost({ principal: borrowAmount, days, ...smartBreakdown })
			: 0;
		const diff = benefitDifference(normalCost, smartCost);
		return { normalCost, smartCost, diff };
	}, [normalDetail, smartDetail, borrowAmount, days]);

	// Show the full list for both dropdowns. Smart/normal differences are handled when fetching detail.
    const normalOptions = useMemo(() => {
        const normals = vaults.filter((v) => !v.isSmart);
        return normals.length > 0 ? normals : vaults; // fallback: show all if chain has only smart vaults
    }, [vaults]);
    const smartOptions = useMemo(() => {
        const smarts = vaults.filter((v) => v.isSmart);
        return smarts.length > 0 ? smarts : vaults; // fallback: show all
    }, [vaults]);

    function renderVaultLabel(v: VaultOption): string {
        return `${v.name} #${v.id}${v.isSmart ? " (smart)" : ""}`;
    }

	return (
		<div className="min-h-screen w-full bg-zinc-50 px-4 py-8 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
			<div className="mx-auto w-full max-w-5xl">
				<div className="mb-6">
					<h1 className="text-3xl font-semibold tracking-tight">Fluid Cost/Benefit Calculator</h1>
					<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
						Compare borrow cost between a normal debt vault and a smart debt vault. Data via Fluid API.
					</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-3">
					<label className="grid gap-2">
						<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Chain</span>
						<select
							value={chainId}
							onChange={(e) => setChainId(Number(e.target.value) as ChainId)}
							className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 transition dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						>
							{CHAINS.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>
					</label>

					<label className="grid gap-2">
						<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Borrow amount</span>
						<input
							type="number"
							value={borrowAmount}
							onChange={(e) => setBorrowAmount(Number(e.target.value))}
							min={0}
							step={1}
							className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 transition placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</label>

					<label className="grid gap-2">
						<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Duration (days)</span>
						<input
							type="number"
							value={days}
							onChange={(e) => setDays(Number(e.target.value))}
							min={1}
							step={1}
							className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 transition placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</label>
				</div>

				<div className="mt-6 grid gap-6 sm:grid-cols-2">
					<div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<h2 className="text-base font-semibold">Normal debt vault</h2>
						<label className="mt-3 grid gap-2">
							<span className="text-sm text-zinc-600 dark:text-zinc-400">Select vault</span>
							<select
								value={normalVaultId}
								onChange={(e) => setNormalVaultId(e.target.value)}
								className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 transition dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
							>
								<option value="">Select…</option>
							{normalOptions.map((v) => (
								<option key={v.id} value={v.id}>
									{renderVaultLabel(v)}
								</option>
							))}
							</select>
						</label>
						<div className="mt-4 grid gap-1 text-sm">
							<div className="text-zinc-600 dark:text-zinc-400">APR (est): <span className="font-semibold text-zinc-900 dark:text-zinc-100">{normalBorrowApr.toFixed(2)}%</span></div>
							<div className="text-zinc-600 dark:text-zinc-400">Cost: <span className="font-semibold text-emerald-600 dark:text-emerald-400">${costs.normalCost.toFixed(2)}</span></div>
						</div>
					</div>

					<div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
						<h2 className="text-base font-semibold">Smart debt vault</h2>
						<label className="mt-3 grid gap-2">
							<span className="text-sm text-zinc-600 dark:text-zinc-400">Select vault</span>
							<select
								value={smartVaultId}
								onChange={(e) => setSmartVaultId(e.target.value)}
								className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none ring-0 transition dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
							>
								<option value="">Select…</option>
							{smartOptions.map((v) => (
								<option key={v.id} value={v.id}>
									{renderVaultLabel(v)}
								</option>
							))}
							</select>
						</label>
						<div className="mt-4 grid gap-1 text-sm">
							<div className="text-zinc-600 dark:text-zinc-400">APR (est): <span className="font-semibold text-zinc-900 dark:text-zinc-100">{smartBorrowApr.toFixed(2)}%</span></div>
							<div className="text-zinc-600 dark:text-zinc-400">Cost: <span className="font-semibold text-emerald-600 dark:text-emerald-400">${costs.smartCost.toFixed(2)}</span></div>
						</div>
					</div>
				</div>

				<div className="mt-8 border-t border-zinc-200 pt-5 dark:border-zinc-800">
					<h3 className="text-base font-semibold">Benefit</h3>
					<div className="mt-1 text-sm">
						Savings vs normal: <span className="font-semibold text-emerald-600 dark:text-emerald-400">${costs.diff.benefit.toFixed(2)}</span> (<span className="font-semibold">{costs.diff.percent.toFixed(2)}%</span>)
					</div>
					{loading && <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Loading vaults…</div>}
					{error && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</div>}
					<p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
						Rates pulled from Fluid API. Smart vault APR includes components like LL rate, token staking APR, DEX trading APR, and vault adjustments as per docs.
					</p>
					<p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">References: see API docs for rates and smart vault fields.</p>
				</div>
			</div>
		</div>
	);
}


