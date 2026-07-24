"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Toast, useToast } from "@/components/ui/toast";
import { EmailHeaderPreview } from "@/components/brand/email-preview";

type Brand = {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  businessName: string | null;
  font: string | null;
  exists: boolean;
};

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX6.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} picker`}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-control border border-[var(--border)] bg-page p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#047857"
          spellCheck={false}
          className="font-mono"
        />
      </div>
    </Field>
  );
}

export default function BrandPage() {
  const qc = useQueryClient();
  const { toast, showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#1a1a2e");
  const [accentColor, setAccentColor] = useState("#047857");
  const [font, setFont] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useQuery({
    queryKey: ["org-brand"],
    queryFn: async () => {
      const brand = await api<Brand>("/api/v1/org/brand", {
        errorMessage: "Failed to load brand settings",
      });
      // Seed the form once; after that the form owns the state.
      setLoaded((already) => {
        if (!already) {
          setBusinessName(brand.businessName ?? "");
          setLogoUrl(brand.logoUrl);
          setPrimaryColor(brand.primaryColor);
          setAccentColor(brand.accentColor);
          setFont(brand.font ?? "");
        }
        return true;
      });
      return brand;
    },
  });

  const save = useMutation({
    mutationFn: () =>
      api<Brand>("/api/v1/org/brand", {
        method: "PUT",
        body: {
          logoUrl,
          primaryColor,
          accentColor,
          businessName: businessName.trim() || null,
          font: font || null,
        },
        errorMessage: "Could not save brand settings",
      }),
    onSuccess: () => {
      setError(null);
      showToast("Brand settings saved");
      void qc.invalidateQueries({ queryKey: ["org-brand"] });
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : "Could not save brand settings"),
  });

  async function uploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // Multipart upload — the api() helper is JSON-only, so raw fetch here.
      const res = await fetch("/api/v1/uploads?kind=logo", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new ApiError(data.error ?? "Upload failed", res.status);
      }
      setLogoUrl(data.url);
      showToast("Logo uploaded");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const formBrand = {
    logoUrl,
    primaryColor,
    accentColor,
    businessName: businessName.trim() || null,
    font: font || null,
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-card border border-[var(--border)] bg-surface p-5">
        <h2 className="text-sm font-semibold">Brand</h2>
        <p className="mt-1 text-xs text-muted">
          Your logo, colors, and font appear on every automated email.
        </p>

        {!loaded ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-4 space-y-4">
            <Field label="Business name">
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
                maxLength={120}
              />
            </Field>

            <Field label="Logo" hint="PNG, JPEG, GIF, WebP or SVG, up to 4 MB.">
              <div className="flex items-center gap-3">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-10 w-auto rounded-control border border-[var(--border)] bg-white p-1"
                  />
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void uploadLogo(e)}
                />
                <Button
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading ? "Uploading…" : logoUrl ? "Replace" : "Upload logo"}
                </Button>
                {logoUrl && (
                  <Button
                    variant="link"
                    size="sm"
                    className="text-critical"
                    onClick={() => setLogoUrl(null)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                label="Primary color"
                value={primaryColor}
                onChange={setPrimaryColor}
              />
              <ColorField
                label="Accent color"
                value={accentColor}
                onChange={setAccentColor}
              />
            </div>

            <Field label="Font">
              <Select value={font} onChange={(e) => setFont(e.target.value)}>
                <option value="">Default</option>
                <option value="system">System</option>
                <option value="serif">Serif</option>
                <option value="mono">Mono</option>
              </Select>
            </Field>

            {error && <p className="text-sm text-critical">{error}</p>}

            <Button
              variant="primary"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save brand"}
            </Button>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Email preview</h2>
        <EmailHeaderPreview brand={formBrand} subject="Thanks for reaching out!" />
        <p className="mt-2 text-xs text-muted">
          Updates live as you edit, this is how the header of your automated emails will
          look.
        </p>
      </div>

      <Toast message={toast} />
    </div>
  );
}
