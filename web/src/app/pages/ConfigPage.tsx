import { useState } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { CacheStatusChip } from "../CacheStatusChip";

interface ConfigPageProps {
	accessToken: string | null;
	apiBase: string;
}

export function ConfigPage({ accessToken, apiBase }: ConfigPageProps) {
	const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
	const [showImportModal, setShowImportModal] = useState(false);
	const [importBusy, setImportBusy] = useState(false);

	return (
		<section className="border bg-card text-card-foreground rounded-lg shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
			<h2 className="text-sm font-medium tracking-wide">Configuration</h2>
			<div className="grid gap-3 text-sm max-w-md">
				<div className="space-y-2">
					<CacheStatusChip accessToken={accessToken} apiBase={apiBase} />
				</div>
				<div>
					<Button
						variant="outline"
						size="sm"
						disabled={!accessToken}
						onClick={async () => {
							if (!accessToken) return;
							try {
								const res = await fetch(new URL("/api/operations/map/export", apiBase), {
									headers: { Authorization: `Bearer ${accessToken}` },
								});
								if (!res.ok) return;
								const json = await res.json();
								const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
								const a = document.createElement("a");
								a.href = URL.createObjectURL(blob);
								const ts = new Date();
								const pad = (n: number) => n.toString().padStart(2, "0");
								a.download = `operation-mappings-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}.json`;
								document.body.appendChild(a);
								a.click();
								a.remove();
								const opCount = typeof json === "object" && json ? Object.keys(json).length : 0;
								toast.success("Exported operation mappings", { description: `${opCount} operations` });
							} catch {
								toast.error("Export failed");
							}
						}}
					>
						Export operation mappings
					</Button>
					<p className="text-xs text-muted-foreground mt-1">
						Download current operation-to-permissions mapping as seed JSON.
					</p>
				</div>
				<div>
					<form
						onSubmit={(e) => {
							e.preventDefault();
						}}
						className="space-y-2"
					>
						<label className="text-xs font-medium">Import operation mappings</label>
						<input
							type="file"
							accept="application/json,.json"
							className="block text-xs"
							disabled={!accessToken}
							aria-label="Import operation mappings JSON file"
							onChange={async (e) => {
								const file = e.target.files?.[0];
								if (!file || !accessToken) return;
								setPendingImportFile(file);
								setShowImportModal(true);
								e.target.value = "";
							}}
						/>
						<p className="text-xs text-muted-foreground">
							Upload a JSON seed file mapping operations to actions. Existing operations are replaced.
						</p>
					</form>
				</div>
			</div>
			<p className="text-xs text-muted-foreground">
				Additional configuration options will appear here in future versions.
			</p>

			{showImportModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div
						className="absolute inset-0 bg-black/40 backdrop-blur-sm"
						onClick={() => !importBusy && setShowImportModal(false)}
					/>
						<div className="relative bg-card text-card-foreground w-full max-w-md rounded-lg shadow-lg border p-5 space-y-4 animate-in fade-in zoom-in">
							<h3 className="text-sm font-semibold">Confirm import</h3>
							<p className="text-xs text-muted-foreground leading-relaxed">
								This will <span className="font-semibold">delete all existing operation mappings</span> and replace them with the contents of {" "}
								<code className="px-1 py-0.5 bg-muted rounded text-[11px]">{pendingImportFile?.name}</code>. This action cannot be undone.
							</p>
							<div className="text-xs text-muted-foreground">
								{pendingImportFile && (
									<div>
										File size: {(Math.round(pendingImportFile.size / 102.4) / 10).toLocaleString()} KB
									</div>
								)}
							</div>
							<div className="flex gap-2 justify-end">
								<Button
									variant="outline"
									size="sm"
									disabled={importBusy}
									onClick={() => {
										setShowImportModal(false);
										setPendingImportFile(null);
									}}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									className="bg-red-600 hover:bg-red-600/90"
									disabled={importBusy || !pendingImportFile || !accessToken}
									onClick={async () => {
										if (!pendingImportFile || !accessToken) return;
										setImportBusy(true);
										try {
											const text = await pendingImportFile.text();
											const json = JSON.parse(text);
											const res = await fetch(new URL("/api/operations/map/import", apiBase), {
												method: "POST",
												headers: {
													"Content-Type": "application/json",
													Authorization: `Bearer ${accessToken}`,
												},
												body: JSON.stringify(json),
											});
											if (!res.ok) {
												toast.error("Import failed");
												return;
											}
											const result = await res.json();
											toast.success(`Import complete`, {
												description: `Removed: ${result.removed}, Created: ${result.created}, Unknown actions: ${result.unknownActions.length}`,
											});
											window.dispatchEvent(new CustomEvent("operation-mappings-updated"));
										} catch (err) {
											toast.error("Invalid file or import error");
										} finally {
											setImportBusy(false);
											setShowImportModal(false);
											setPendingImportFile(null);
										}
									}}
								>
									{importBusy ? "Importing…" : "Yes, replace mappings"}
								</Button>
							</div>
						</div>
				</div>
			)}
		</section>
	);
}
