import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Data Processing Agreement · LeadCoda",
  description:
    "LeadCoda's Data Processing Agreement: how we process lead data on behalf of our customers as a processor under GDPR and similar laws.",
};

export default function DpaPage() {
  return (
    <LegalShell title="Data Processing Agreement" updated="July 22, 2026">
      <p>
        This Data Processing Agreement, the DPA, forms part of the agreement
        between the customer and LeadCoda for use of the LeadCoda service. It
        applies whenever LeadCoda processes personal data on the customer's
        behalf, and it is written to satisfy Article 28 of the GDPR and
        similar requirements in other privacy laws.
      </p>

      <h2>Parties and roles</h2>
      <p>
        The customer is the controller of the personal data it stores in its
        LeadCoda workspace, and LeadCoda is the processor. The customer
        decides what lead data to collect, who to message, and when to delete
        records; LeadCoda processes that data only to provide the service.
        For data about the customer's own account, LeadCoda acts as an
        independent controller as described in our Privacy Policy, and that
        data is outside the scope of this DPA.
      </p>

      <h2>Scope and purpose of processing</h2>
      <p>
        LeadCoda processes lead contact data for one purpose: providing the
        CRM and messaging service the customer has subscribed to. This
        includes storing lead records, running the automations the customer
        configures, delivering email and SMS on the customer's behalf,
        syncing leads from connected ad accounts, and producing the reporting
        the customer sees in the product.
      </p>

      <h2>Duration</h2>
      <p>
        This DPA applies for the term of the customer's agreement with
        LeadCoda and continues for as long as LeadCoda processes personal
        data on the customer's behalf, including the post-termination export
        and deletion period described below.
      </p>

      <h2>Nature of the data and data subjects</h2>
      <p>
        The personal data processed consists of the information the customer
        stores about its leads: names, email addresses, phone numbers, the
        content of messages exchanged with those leads, consent records, and
        any notes or custom fields the customer adds. The data subjects are
        the customer's leads, contacts, and prospective or current clients.
        The service is not designed for special categories of data, and the
        customer agrees not to store such data in LeadCoda.
      </p>

      <h2>Processor obligations</h2>
      <p>
        LeadCoda processes personal data only on the customer's documented
        instructions, which consist of the agreement, this DPA, and the
        customer's use of the product's settings and features, unless
        processing is required by law, in which case LeadCoda will inform the
        customer unless the law prohibits it. LeadCoda ensures that every
        person authorized to process the data is bound by confidentiality.
        LeadCoda maintains appropriate technical and organizational security
        measures, including encryption of data in transit and at rest,
        access controls, and application-level encryption of stored
        credentials, as summarized on our Security page. If LeadCoda becomes
        aware of a personal data breach affecting the customer's data, it
        will notify the customer without undue delay and in any event within
        72 hours, and will provide the information the customer needs to meet
        its own notification obligations. LeadCoda will assist the customer,
        through the product's export, correction, and deletion tools and
        through direct support, in responding to data subject requests and in
        meeting its obligations around security, breach notification, and
        impact assessments. On termination of the agreement, LeadCoda will
        delete or return the personal data at the customer's choice, subject
        to the 30-day export window in the Terms of Service, after which data
        is deleted and rolls out of backups within 35 days.
      </p>

      <h2>Subprocessors</h2>
      <p>
        The customer grants LeadCoda general authorization to engage
        subprocessors to provide the service. The current list, including
        each subprocessor's purpose, is maintained on our Security page at
        /security and currently includes Vercel for hosting, Neon for the
        database, Resend for email delivery, Twilio for SMS delivery, Stripe
        for payments, and Meta Platforms for lead ads sync when the customer
        connects a Meta account. LeadCoda will give the customer at least 30
        days notice before adding or replacing a subprocessor that processes
        customer lead data, and the customer may object on reasonable data
        protection grounds; if the objection cannot be resolved, the customer
        may terminate the affected service with a prorated refund of prepaid
        fees. LeadCoda imposes data protection obligations on each
        subprocessor that are no less protective than those in this DPA and
        remains responsible for their performance.
      </p>

      <h2>International transfers</h2>
      <p>
        Where processing involves transferring personal data out of the
        European Economic Area, the United Kingdom, or Switzerland to a
        country without an adequacy decision, the parties rely on the
        European Commission's Standard Contractual Clauses, which are
        incorporated into this DPA by reference, together with the UK and
        Swiss addenda where applicable. LeadCoda will keep its transfer
        mechanisms current as the legal landscape changes.
      </p>

      <h2>Audit rights</h2>
      <p>
        On request, and no more than once per year absent a specific
        incident, LeadCoda will make available summary reports of its
        security practices and will complete reasonable security
        questionnaires so the customer can verify compliance with this DPA.
        Where the customer's regulator requires more, the parties will agree
        on a reasonable process that protects the confidentiality of
        LeadCoda's systems and of other customers' data.
      </p>

      <h2>Liability</h2>
      <p>
        Each party's liability under this DPA is subject to the limitations
        and exclusions of liability in the main agreement, and this DPA does
        not create separate or additional caps. Nothing in this section
        limits either party's liability where the law does not allow it to
        be limited.
      </p>

      <h2>Getting a signed copy</h2>
      <p>
        This DPA applies automatically to every customer as part of our
        Terms of Service. If your organization needs a countersigned copy for
        its records or its own compliance program, email legal@leadcoda.com
        and we will provide one.
      </p>
    </LegalShell>
  );
}
