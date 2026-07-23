"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { useProperties } from "@/lib/queries";
import { useVertical } from "@/components/vertical-provider";

/** Add a single lead by hand. Requires a name + email or phone. */
export function AddLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (leadId: string) => void;
}) {
  const qc = useQueryClient();
  const pack = useVertical();
  const { data: properties = [] } = useProperties();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setError("Name is required");
    if (!email.trim() && !phone.trim())
      return setError("Add an email or a phone number");
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ leadId: string; merged: boolean }>("/api/v1/leads", {
        method: "POST",
        body: {
          name,
          email,
          phone,
          propertyName,
          notes,
          emailConsent: consent,
          smsConsent: consent,
        },
        errorMessage: "Could not add lead",
      });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["leads-count"] });
      onCreated?.(res.leadId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add a lead" size="sm" onClose={onClose}>
      <div className="space-y-3 p-5">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(305) 555-0100"
            />
          </Field>
        </div>
        {properties.length > 0 && (
          <Field label={pack.context.singular}>
            <Select value={propertyName} onChange={(e) => setPropertyName(e.target.value)}>
              <option value="">— none —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </Field>

        <label className="flex items-start gap-2 text-xs text-ink-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I have this person's permission to contact them by email/text. Required before any
            sequence can send to them.
          </span>
        </label>

        {error && <p className="text-sm text-critical">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "Adding…" : "Add lead"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
