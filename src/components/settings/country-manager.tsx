'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, X, Loader2, Globe, Upload, FileText, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Country } from '@/types';

interface ParsedCountry {
  name: string;
  code: string;
}

function parseCountryCSV(text: string): ParsedCountry[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));

  const nameIdx = headers.indexOf('name');
  const codeIdx = headers.indexOf('code');

  if (nameIdx === -1 || codeIdx === -1) return [];

  const rows: ParsedCountry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const name = values[nameIdx]?.replace(/["']/g, '').trim();
    const code = values[codeIdx]?.replace(/["']/g, '').trim();

    if (!name || !code) continue;

    rows.push({ name, code });
  }

  return rows;
}

export function CountryManager() {
  const supabase = createClient();
  const { user, accountId, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Single Add Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');
  const [saving, setSaving] = useState(false);

  // Bulk Upload Dialog States
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCountry[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Dialog States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!accountId) {
      setLoading(false);
      return;
    }
    fetchCountries(accountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, accountId]);

  async function fetchCountries(acctId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('account_id', acctId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCountries(data || []);
    } catch (err) {
      console.error('Failed to fetch countries:', err);
      toast.error('Failed to load countries');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newCountryName.trim()) {
      toast.error('Country name is required');
      return;
    }
    if (!newCountryCode.trim()) {
      toast.error('Country code is required');
      return;
    }

    // Standardize code to start with '+'
    let code = newCountryCode.trim();
    if (!code.startsWith('+')) {
      code = `+${code}`;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('countries')
        .insert({
          account_id: accountId,
          name: newCountryName.trim(),
          code,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Country name or code already exists.');
        }
        throw error;
      }

      setCountries((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Country added successfully');
      setDialogOpen(false);
      setNewCountryName('');
      setNewCountryCode('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to add country');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!countryToDelete) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('countries')
        .delete()
        .eq('id', countryToDelete.id);

      if (error) throw error;

      setCountries((prev) => prev.filter((c) => c.id !== countryToDelete.id));
      toast.success('Country deleted');
      setDeleteDialogOpen(false);
      setCountryToDelete(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete country');
    } finally {
      setDeleting(false);
    }
  }

  // Bulk Upload logic
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setBulkFile(selected);
    setImportResult(null);

    const text = await selected.text();
    const rows = parseCountryCSV(text);

    if (rows.length === 0) {
      toast.error('No valid rows found. Ensure CSV has "name" and "code" headers.');
      setParsedRows([]);
      return;
    }

    setParsedRows(rows);
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);

    try {
      let imported = 0;
      let failed = 0;

      // Batch insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < parsedRows.length; i += chunkSize) {
        const chunk = parsedRows.slice(i, i + chunkSize);
        const rows = chunk.map((row) => {
          let code = row.code.trim();
          if (!code.startsWith('+')) code = `+${code}`;
          return {
            account_id: accountId,
            name: row.name.trim(),
            code,
          };
        });

        const { data, error } = await supabase
          .from('countries')
          .insert(rows)
          .select('id');

        if (error) {
          // If batch fails, try individual inserts to proceed past duplicates
          for (const row of rows) {
            const { error: singleErr } = await supabase.from('countries').insert(row);
            if (singleErr) {
              failed++;
            } else {
              imported++;
            }
          }
        } else {
          imported += data?.length ?? chunk.length;
        }
      }

      setImportResult({ imported, failed });
      if (imported > 0) {
        toast.success(`${imported} countr${imported !== 1 ? 'ies' : 'y'} imported`);
        if (accountId) fetchCountries(accountId);
      }
      if (failed > 0) {
        toast.error(`${failed} country entries failed to import (likely duplicates)`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const downloadCsvTemplate = () => {
    const csvContent = "name,code\nIndia,+91\nUnited States,+1\nUnited Kingdom,+44\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "wacrm_countries_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function resetBulk() {
    setBulkFile(null);
    setParsedRows([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-6 text-white max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Countries & Dial Codes</h2>
          <p className="text-sm text-slate-400">
            Configure country names and codes to parse international dial formats.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setBulkDialogOpen(true)}
            variant="outline"
            className="border-slate-800 bg-slate-900/40 text-slate-200 hover:bg-slate-850"
          >
            <Upload className="mr-2 size-4" />
            Bulk Import CSV
          </Button>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Plus className="mr-2 size-4" />
            Add Country
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-900 rounded-xl px-3 py-2">
        <Globe className="size-4 text-slate-500 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search country name or code..."
          className="bg-transparent border-none text-sm text-white outline-none w-full placeholder:text-slate-600"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-500">
          <Loader2 className="size-6 animate-spin text-primary mr-2" />
          Loading countries...
        </div>
      ) : filteredCountries.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Globe className="size-10 text-slate-700 mb-3" />
            <p className="font-semibold text-slate-300">No countries found</p>
            <p className="text-sm text-slate-500 mt-1">
              Add a country code manually or perform a bulk CSV upload to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {filteredCountries.map((c) => (
            <Card key={c.id} className="bg-slate-900/40 border-slate-800 hover:border-slate-750 transition-all select-none">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate text-sm">{c.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{c.code}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setCountryToDelete(c);
                    setDeleteDialogOpen(true);
                  }}
                  className="size-8 text-slate-500 hover:text-red-400 hover:bg-slate-800/50 shrink-0"
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Single Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add Country</DialogTitle>
            <DialogDescription className="text-slate-400">
              Configure a country code prefix (e.g. +91 for India).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="country-name" className="text-slate-300">
                Country Name
              </Label>
              <Input
                id="country-name"
                value={newCountryName}
                onChange={(e) => setNewCountryName(e.target.value)}
                placeholder="India"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country-code" className="text-slate-300">
                Country Code
              </Label>
              <Input
                id="country-code"
                value={newCountryCode}
                onChange={(e) => setNewCountryCode(e.target.value)}
                placeholder="+91"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Country
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Country</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete {countryToDelete?.name}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => {
        if (!open) resetBulk();
        setBulkDialogOpen(open);
      }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Bulk Import Countries</DialogTitle>
            <div className="text-slate-400 text-sm space-y-2">
              <p>
                Upload a CSV containing &quot;name&quot; and &quot;code&quot; headers to import multiple countries at once.
              </p>
              <div>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                >
                  <FileText className="size-3.5" />
                  Download CSV Template
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 p-6 cursor-pointer hover:border-primary/50 transition-colors bg-slate-950/20"
            >
              {bulkFile ? (
                <>
                  <FileText className="size-8 text-primary animate-pulse" />
                  <p className="text-sm text-slate-350">{bulkFile.name}</p>
                  <p className="text-xs text-slate-500">
                    {parsedRows.length} country entries detected
                  </p>
                </>
              ) : (
                <>
                  <Upload className="size-8 text-slate-600" />
                  <p className="text-sm text-slate-400">Click to select CSV file</p>
                  <p className="text-xs text-slate-600">CSV with headers &quot;name&quot;, &quot;code&quot; required</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {parsedRows.length > 0 && !importResult && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Preview (First {Math.min(parsedRows.length, 3)} rows)
                </p>
                <div className="rounded-lg border border-slate-800 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-850 text-slate-400">
                        <th className="px-3 py-1.5 font-medium">Name</th>
                        <th className="px-3 py-1.5 font-medium">Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 3).map((r, i) => (
                        <tr key={i} className="border-t border-slate-800">
                          <td className="px-3 py-1.5 text-slate-300">{r.name}</td>
                          <td className="px-3 py-1.5 text-slate-400 font-mono">{r.code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importResult && (
              <div className="rounded-lg border border-slate-800 p-3 bg-slate-950/20 space-y-1">
                <p className="text-xs font-bold text-slate-300 uppercase">Import Summary</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-primary flex items-center gap-1"><CheckCircle className="size-3.5" />{importResult.imported} imported</span>
                  {importResult.failed > 0 && <span className="text-red-400 flex items-center gap-1"><XCircle className="size-3.5" />{importResult.failed} failed</span>}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && (
              <Button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || importing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                {importing && <Loader2 className="mr-2 size-4 animate-spin" />}
                Import {parsedRows.length > 0 ? `${parsedRows.length} Countries` : ''}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
