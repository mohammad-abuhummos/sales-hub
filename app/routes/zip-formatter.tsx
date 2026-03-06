import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import type { Route } from "./+types/zip-formatter";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Zip Code Formatter | Sales Hub" },
    { name: "description", content: "Format zip codes from CSV or Excel files" },
  ];
}

function parseZipCodesFromFile(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read file"));
          return;
        }

        const extension = file.name.split(".").pop()?.toLowerCase();

        if (extension === "csv") {
          const text = typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);
          const lines = text.split(/\r?\n/).filter((line) => line.trim());
          const zips = lines.map((line) => {
            const firstCol = line.split(",")[0]?.trim() ?? "";
            return firstCol.replace(/^["']|["']$/g, "");
          }).filter((zip) => zip.length > 0);
          resolve(zips);
        } else if (["xlsx", "xls"].includes(extension ?? "")) {
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
            header: 1,
            defval: "",
          });
          const zips = rows
            .map((row) => {
              const firstCell = Array.isArray(row) ? row[0] : (row as Record<string, unknown>)[Object.keys(row as Record<string, unknown>)[0]];
              const val = String(firstCell ?? "").trim();
              return val;
            })
            .filter((zip) => zip.length > 0);
          resolve(zips);
        } else {
          reject(new Error("Unsupported file type. Use CSV or XLSX."));
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));

    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

export default function ZipFormatter() {
  const [zips, setZips] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file) return;

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const validExt = [".csv", ".xlsx", ".xls"];
    const hasValidExt = validExt.some((ext) => file.name.toLowerCase().endsWith(ext));
    const hasValidType = validTypes.some((t) => file.type === t) || file.type === "";

    if (!hasValidExt && !hasValidType) {
      setError("Please upload a CSV or XLSX file.");
      return;
    }

    try {
      const parsed = await parseZipCodesFromFile(file);
      setZips(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setZips([]);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const copyToClipboard = async () => {
    const str = zips.join(", ");
    await navigator.clipboard.writeText(str);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const commaString = zips.join(", ");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">
            Sales Hub
          </h1>
          <p className="text-slate-500 mt-1">Tools for sales teams</p>
        </header>

        <div className="space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                Zip Code Formatter
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Upload a CSV or Excel file. Zip codes from the first column will be extracted and formatted.
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed rounded-xl p-10 text-center transition-all
                  ${isDragging
                    ? "border-blue-500 bg-blue-50/50"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                  }
                `}
              >
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleInputChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="pointer-events-none">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-slate-700 font-medium">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    CSV, XLSX, or XLS — first column will be used
                  </p>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {zips.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      {zips.length} zip code{zips.length !== 1 ? "s" : ""} found
                    </span>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
                    >
                      {copied ? (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy to clipboard
                        </>
                      )}
                    </button>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 max-h-48 overflow-y-auto">
                    <pre className="text-sm text-slate-600 whitespace-pre-wrap break-all font-mono">
                      {commaString}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
