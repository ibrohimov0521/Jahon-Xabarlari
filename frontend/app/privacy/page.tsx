import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `How ${SITE_NAME} handles website, Instagram and support data.`,
  alternates: { canonical: `${SITE_URL}/privacy` }
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${SITE_NAME} respects your privacy. This policy explains what information we handle when you use our website, Instagram integrations, support channels and related publishing tools.`}
      sections={[
        {
          title: "Information we process",
          children: (
            <>
              <p>Depending on the feature you use, we may process your name, username, account identifier, contact details, messages sent to us, comments, media and technical information needed to operate the service.</p>
              <p>For Instagram features, this can include an Instagram user ID, username or display name when provided by Meta, Direct messages, message metadata, comments and publishing-related data. We only request data needed for an enabled feature.</p>
            </>
          )
        },
        {
          title: "How we use information",
          children: (
            <>
              <p>We use information to publish and manage news, respond to support requests, communicate with users, moderate conversations, protect the service, prevent abuse, troubleshoot failures and improve reliability.</p>
              <p>When enabled, an AI service may help prepare a reply or clean and classify news content. AI output can be inaccurate and may require administrator review before it is sent or published.</p>
            </>
          )
        },
        {
          title: "Third-party services",
          children: <p>We may use Meta and Instagram APIs, OpenAI services, hosting providers, databases, media storage and monitoring tools to provide the features described above. These providers process data under their own terms and privacy policies. We do not sell personal information or use Instagram messages for advertising sales.</p>
        },
        {
          title: "Retention and security",
          children: (
            <>
              <p>We retain information only for as long as reasonably necessary for the relevant feature, support, security, legal and operational purposes. Published content may remain available until it is removed by an administrator or the relevant source.</p>
              <p>We use access controls, secrets management, logging and other reasonable safeguards. No online service can guarantee absolute security, so please do not send passwords, access tokens or other secrets in a message.</p>
            </>
          )
        },
        {
          title: "Your choices and deletion requests",
          children: <p>You may request access to or deletion of personal information connected with your support or Instagram conversation. Please use our <a className="font-semibold text-blue-600 hover:underline dark:text-blue-400" href="/data-deletion">Data Deletion</a> instructions. We may keep minimal records required for legal, fraud-prevention or security purposes.</p>
        }
      ]}
    />
  );
}
