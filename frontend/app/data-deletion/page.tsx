import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: `Data Deletion | ${SITE_NAME}`,
  description: `Request deletion of personal data connected with ${SITE_NAME}.`,
  alternates: { canonical: `${SITE_URL}/data-deletion` }
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Data Deletion Request"
      intro="You can ask us to delete personal information connected with your website support request or Instagram conversation. We use email so the request can be verified securely."
      sections={[
        {
          title: "How to request deletion",
          children: <ol className="list-decimal space-y-2 pl-5"><li>Send an email to the address shown below with the subject “Data deletion request”.</li><li>Include your Instagram username, the approximate date of the conversation and the email address we can use to contact you.</li><li>Briefly describe the messages or account data you want deleted.</li></ol>
        },
        { title: "What not to send", children: <p>Never include your password, access token, authentication code or other secret in the request. We may ask for reasonable information to verify the request, but we will not ask for your password or private token.</p> },
        { title: "Processing the request", children: <p>After verification, we will delete the relevant conversation and personal data from active systems where applicable. Minimal records may remain when required for legal compliance, fraud prevention, security or audit purposes.</p> }
      ]}
    >
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-slate-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-slate-200">
        <p className="font-semibold">Start a deletion request</p>
        <a className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700" href="mailto:admin@bestteam.uz?subject=Data%20deletion%20request">Email the privacy contact</a>
      </div>
    </LegalPage>
  );
}
