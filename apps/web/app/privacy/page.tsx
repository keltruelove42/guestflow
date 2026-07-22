import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy · LeadCoda",
  description:
    "How LeadCoda collects, uses, and protects data, both for our customers and for the leads our customers manage in the platform.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 22, 2026">
      <p>
        LeadCoda is a follow-up CRM. Businesses use it to store their leads,
        send automated email and SMS follow-up, run ad campaigns, and track
        their pipeline. This policy explains what data we collect, how we use
        it, and the choices you have. We have tried to write it in plain
        English. If anything is unclear, email us at privacy@leadcoda.app and
        a human will answer.
      </p>

      <h2>Two kinds of data, two roles</h2>
      <p>
        There are two distinct categories of personal data in LeadCoda, and we
        play a different role for each. First, there is data about you, our
        customer: your account email, your name, your workspace settings and
        content, and billing details processed by Stripe. For this data,
        LeadCoda is the controller and this policy governs directly.
      </p>
      <p>
        Second, there is data our customers store about their own leads: the
        names, email addresses, phone numbers, notes, and message history of
        the people a business is following up with. For this data, the
        customer is the controller and LeadCoda is a processor acting on the
        customer's instructions. If you are a lead whose information appears
        in a LeadCoda workspace, the business that added you is responsible
        for that data, and requests about it should go to them first. We help
        our customers honor those requests, and our Data Processing Agreement
        describes our obligations as a processor in detail.
      </p>

      <h2>Data we collect from you</h2>
      <p>
        When you create an account we collect your email address, your name,
        and the name of your business or workspace. Everything you put into
        your workspace, such as leads, sequences, templates, and messages, is
        stored so we can provide the service. If you subscribe to a paid plan,
        payment is handled by Stripe; we receive confirmation of payment and
        the last four digits of your card, but full card numbers never touch
        our servers.
      </p>

      <h2>Data we collect automatically</h2>
      <p>
        Like most web services, we keep server logs that include IP addresses,
        request times, and error details, and we record basic device and
        browser information so we can debug problems and keep the service
        secure. We use cookies only for session authentication, that is, to
        keep you signed in. We do not use advertising or cross-site tracking
        cookies, and we do not embed third-party ad trackers on the product.
      </p>

      <h2>How we use data</h2>
      <p>
        We use your data to provide and improve the service, to send
        transactional email such as receipts, alerts, and account notices, and
        to respond to support requests. We never sell personal data, yours or
        your leads', to anyone. We never use the lead data our customers store
        in LeadCoda for advertising, profiling, or any purpose other than
        running the service for that customer.
      </p>

      <h2>Message consent and opt-outs</h2>
      <p>
        LeadCoda is built around consent-based messaging. The product records
        email and SMS consent per lead, so your workspace keeps a record of
        who agreed to be contacted and how. Marketing emails sent through
        LeadCoda include an unsubscribe link that we enforce automatically,
        and SMS messages honor STOP replies: when a lead texts STOP, we mark
        them as opted out and block further messages to that number from your
        workspace. Customers remain responsible for having lawful consent for
        the people they message, as described in our Terms of Service.
      </p>

      <h2>Subprocessors</h2>
      <p>
        We rely on a small set of vendors to run LeadCoda, each for a specific
        purpose: Vercel hosts the application, Neon hosts our database, Resend
        delivers email, Twilio delivers SMS, Stripe processes payments, and
        Meta Platforms is used to sync lead ads when you connect a Meta
        account. Each vendor is bound by a data processing agreement, and we
        maintain the current list with details on our Security page. We give
        notice before adding a new subprocessor that handles customer lead
        data.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your data for as long as your account is active. You can
        export your workspace data at any time, and you can ask us to delete
        your account and everything in it by emailing privacy@leadcoda.app.
        Deletion requests are honored promptly, and deleted data rolls out of
        our encrypted backups within 35 days.
      </p>

      <h2>Your rights under GDPR</h2>
      <p>
        If you are in the European Union, the United Kingdom, or another
        region with similar laws, you have the right to access the personal
        data we hold about you, to correct it, to have it erased, to receive
        a portable copy, and to object to certain processing. Our legal bases
        for processing your account data are performance of our contract with
        you and our legitimate interest in operating and securing the
        service. To exercise any of these rights, contact
        privacy@leadcoda.app. If you believe we have not resolved your
        concern, you may also lodge a complaint with your local supervisory
        authority.
      </p>

      <h2>Your rights under CCPA</h2>
      <p>
        If you are a California resident, you have the right to know what
        personal information we collect about you, the right to request its
        deletion, and the right not to be discriminated against for
        exercising those rights. We do not sell personal information and we
        do not share it for cross-context behavioral advertising, so there is
        nothing to opt out of on that front. Requests can be sent to
        privacy@leadcoda.app.
      </p>

      <h2>Security</h2>
      <p>
        All traffic to and from LeadCoda is encrypted in transit with TLS,
        and data is encrypted at rest in our database and backups. Sensitive
        credentials, such as the API keys you connect for messaging
        providers, receive an additional layer of application-level
        encryption so they are never stored in plaintext. You can read more
        on our Security page, and you can report a vulnerability or concern
        to security@leadcoda.app.
      </p>

      <h2>Children</h2>
      <p>
        LeadCoda is a business tool and is not intended for anyone under 16.
        We do not knowingly collect personal data from children. If you
        believe a child has provided us data, contact privacy@leadcoda.app
        and we will delete it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we make a material
        change, we will update the date at the top of this page and notify
        account owners by email before the change takes effect. Continued use
        of the service after that date means you accept the updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy at LeadCoda can be sent to
        privacy@leadcoda.app. For security matters, use
        security@leadcoda.app. We aim to respond to every request within a
        few business days.
      </p>
    </LegalShell>
  );
}
