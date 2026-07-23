"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useVertical } from "@/components/vertical-provider";
import { api } from "@/lib/api";
import { PropertyType } from "@guestflow/shared";

/** Focus styling the shared controls don't include; kept for pixel parity. */
const FOCUS = "outline-none focus:border-accent";

export function AddPropertyModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const pack = useVertical();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bedrooms, setBedrooms] = useState(2);
  const [type, setType] = useState<string>(PropertyType.SHORT_TERM);
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [directBookingUrl, setDirectBookingUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [previewNote, setPreviewNote] = useState<string | null>(null);

  async function fetchPreview() {
    const url = directBookingUrl.trim();
    if (!url) {
      setPreviewNote("Paste your listing or booking URL above first");
      return;
    }
    setFetchingPreview(true);
    setPreviewNote(null);
    try {
      const data = await api<{ image?: string; description?: string; title?: string }>(
        "/api/v1/properties/preview",
        { method: "POST", body: { url }, errorMessage: "Could not fetch a preview" },
      );
      if (data.image) setImageUrl(data.image);
      if (data.description || data.title) {
        setDescription(data.description ?? data.title ?? "");
      }
      if (!name.trim() && data.title) setName(data.title);
      setPreviewNote(
        data.image
          ? "Pulled the photo and description from your listing. Edit anything below."
          : "Pulled the description, but that site did not share a photo. You can paste an image URL below.",
      );
    } catch (e) {
      setPreviewNote(e instanceof Error ? e.message : "Could not fetch a preview");
    } finally {
      setFetchingPreview(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Name is required");
      // Hand-rolled fetch (not api()): the fallback message depends on the
      // status code (401 → "session expired"), which api() can't express.
      const res = await fetch("/api/v1/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || null,
          bedrooms,
          type,
          knowledgeBase: knowledgeBase.trim() || null,
          directBookingUrl: directBookingUrl.trim() || null,
          photoUrl: pack.context.icon,
          imageUrl: imageUrl.trim() || null,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error(
            data.error ??
              "Session expired, close this, sign out, and sign back in.",
          );
        }
        throw new Error(data.error ?? "Could not add");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  // Not the shared <Modal>: this card is max-w-lg (Modal only offers md/xl/…)
  // and has no max-h/scroll on the card, so Modal wouldn't be pixel-identical.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{`Add a ${pack.context.singular.toLowerCase()}`}</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Name">
            <Input
              className={FOCUS}
              placeholder="e.g. Seaside Cottage"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Location">
            <Input
              className={FOCUS}
              placeholder="City, State"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bedrooms">
              <Input
                type="number"
                min={0}
                className={FOCUS}
                value={bedrooms}
                onChange={(e) => setBedrooms(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Rental type">
              <Select
                className={FOCUS}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value={PropertyType.SHORT_TERM}>Short-term</option>
                <option value={PropertyType.LONG_TERM}>Long-term</option>
                <option value={PropertyType.BOTH}>Both</option>
              </Select>
            </Field>
          </div>
          <Field label="Listing / booking URL (optional)">
            <div className="flex gap-2">
              <Input
                className={FOCUS}
                placeholder="Airbnb, VRBO, or booking page link"
                value={directBookingUrl}
                onChange={(e) => setDirectBookingUrl(e.target.value)}
              />
              <button
                type="button"
                disabled={fetchingPreview}
                className="shrink-0 rounded-control border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-60"
                onClick={fetchPreview}
              >
                {fetchingPreview ? "Fetching…" : "✨ Auto-fill"}
              </button>
            </div>
            {previewNote && (
              <p className="mt-1 text-xs text-ink-2">{previewNote}</p>
            )}
          </Field>
          {imageUrl && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Listing thumbnail"
                className="h-16 w-24 rounded-control border border-[var(--border)] object-cover"
                onError={() => setImageUrl("")}
              />
              <button
                type="button"
                className="text-xs text-muted underline"
                onClick={() => setImageUrl("")}
              >
                Remove photo
              </button>
            </div>
          )}
          <Field label="Photo URL (optional)">
            <Input
              className={FOCUS}
              placeholder="https://…/photo.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Field>
          <Field label="Short description (optional)">
            <Textarea
              className={`min-h-[60px] ${FOCUS}`}
              placeholder="A one-or-two-line description shown on the card"
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="FAQ / house rules (AI assistant uses this)">
            <Textarea
              className={`min-h-[80px] ${FOCUS}`}
              placeholder="Pets, dock, check-in, amenities…"
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-critical">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={saving} onClick={save}>
              {saving ? "Adding…" : `Add ${pack.context.singular.toLowerCase()}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
