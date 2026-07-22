import type { Metadata } from "next";
import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service · LeadCoda",
  description:
    "The terms that govern use of LeadCoda, the follow-up CRM for automated email and SMS follow-up, pipeline management, and ad campaigns.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 22, 2026">
      <p>
        These terms are a contract between you and LeadCoda. By creating an
        account or using the service, you agree to them. If you are using
        LeadCoda on behalf of a company, you confirm that you have authority
        to bind that company, and "you" means the company. If you do not
        agree to these terms, do not use the service.
      </p>

      <h2>The service</h2>
      <p>
        LeadCoda is a follow-up CRM. It lets businesses store and manage
        leads, send automated email and SMS sequences, run ad campaigns with
        lead forms, and track pipeline and revenue. We may add, change, or
        remove features over time, and we will give reasonable notice of any
        change that materially reduces core functionality on a paid plan.
      </p>

      <h2>Accounts and workspaces</h2>
      <p>
        You are responsible for your account credentials and for everything
        that happens in your workspace, including actions taken by team
        members you invite. Keep your password secure, use accurate account
        information, and tell us promptly at legal@leadcoda.app if you
        believe your account has been compromised. You must be at least 16
        years old and legally able to enter into a contract to use LeadCoda.
      </p>

      <h2>Acceptable use</h2>
      <p>
        LeadCoda is for consent-based follow-up, not spam. You may only
        message people from whom you have lawful consent or another valid
        legal basis, and you must comply with applicable messaging laws,
        including the TCPA and CAN-SPAM in the United States, along with
        carrier rules and registration requirements for SMS. LeadCoda
        enforces unsubscribe links on marketing email and STOP opt-outs on
        SMS automatically, but that tooling does not shift responsibility:
        the lawfulness of your lists and your messages is yours. You also may
        not use the service for content or conduct that is illegal,
        deceptive, harassing, or harmful, may not attempt to breach or probe
        our security, and may not resell or scrape the service. We may
        suspend or terminate accounts that violate this section, and where
        the violation involves spam or unlawful messaging we may do so
        without notice to protect deliverability for everyone else.
      </p>

      <h2>Messaging costs</h2>
      <p>
        Depending on your plan, messages are sent either through your own
        Twilio or Resend accounts, in which case those providers bill you
        directly under their own terms, or through managed sending that we
        operate for you, in which case usage fees may apply as described on
        the pricing page. You are responsible for charges incurred by
        messages your workspace sends, including messages sent by your
        automations.
      </p>

      <h2>Free trial</h2>
      <p>
        We offer a free trial with no credit card required. During the trial
        you get access to the features of the trial plan. When the trial
        ends, your data is retained and you can still sign in, but automations
        pause until you subscribe to a paid plan. We may adjust trial length
        and terms for new signups at any time.
      </p>

      <h2>Paid plans and billing</h2>
      <p>
        Paid subscriptions are billed through Stripe and renew automatically
        at the end of each billing period, monthly or annual, until you
        cancel. You can cancel at any time from your workspace settings, and
        cancellation takes effect at the end of the current period; we do not
        prorate partial periods. Annual plans come with a 30-day money-back
        guarantee: if you are unhappy within the first 30 days of an annual
        subscription, email legal@leadcoda.app and we will refund it in
        full. Prices may change with at least 30 days notice, and a price
        change never applies before your next renewal.
      </p>

      <h2>Intellectual property</h2>
      <p>
        Your data is yours. You retain all rights to the leads, messages,
        templates, and other content you put into your workspace, and you
        grant us only the license needed to host and process it to run the
        service. LeadCoda and its licensors own the platform itself,
        including the software, design, and branding, and nothing in these
        terms transfers any of that to you.
      </p>

      <h2>Confidentiality</h2>
      <p>
        Each party may learn non-public information about the other while
        using or providing the service. Each party agrees to protect the
        other's confidential information with reasonable care, to use it
        only as needed to perform under these terms, and not to disclose it
        except to those who need it and are bound by similar obligations, or
        where disclosure is required by law.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The service is provided "as is" and "as available." We work hard to
        keep LeadCoda fast and reliable, but we do not warrant that it will
        be uninterrupted or error free, and we make no guarantee about email
        or SMS delivery rates, which depend on carriers, inbox providers, and
        the quality of your lists, nor about any business outcome such as
        replies, bookings, or revenue. To the fullest extent permitted by
        law, we disclaim all implied warranties, including merchantability
        and fitness for a particular purpose.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, neither party is liable for
        indirect, incidental, special, or consequential damages, or for lost
        profits, revenue, or data. Our total liability arising out of or
        related to the service is capped at the fees you paid us in the 12
        months before the event giving rise to the claim. These limits do not
        apply to your payment obligations or to either party's breach of the
        other's intellectual property rights.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the service and delete your account at any time.
        We may suspend or terminate your account for breach of these terms,
        with notice where practical. After termination for any reason, you
        have a 30-day window to export your data, after which we may delete
        it in line with our Privacy Policy. Sections that by their nature
        should survive termination, including intellectual property,
        confidentiality, disclaimers, and limitation of liability, do
        survive.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the State of North Carolina,
        USA, without regard to conflict of law rules, and any dispute that
        cannot be resolved informally will be brought in the state or federal
        courts located in North Carolina. Both parties consent to the
        jurisdiction of those courts.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. For material changes we
        will update the date at the top of this page and notify account
        owners by email at least 14 days before the change takes effect.
        Continued use of the service after that date means you accept the
        updated terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to legal@leadcoda.app. For
        privacy matters, see our Privacy Policy or write to
        privacy@leadcoda.app.
      </p>
    </LegalShell>
  );
}
