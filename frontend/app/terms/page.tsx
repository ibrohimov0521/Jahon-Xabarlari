import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { SITE_NAME, SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: `Terms of Service | ${SITE_NAME}`,
  description: `Terms for using the ${SITE_NAME} website and connected publishing services.`,
  alternates: { canonical: `${SITE_URL}/terms` }
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms govern your use of the ${SITE_NAME} website, support channels and connected publishing features.`}
      sections={[
        { title: "Acceptable use", children: <p>Use the service lawfully and respectfully. Do not submit unlawful, abusive, deceptive, infringing, malicious or confidential content that you are not authorized to share. You must follow applicable Meta and Instagram rules when using connected accounts.</p> },
        { title: "News and AI-assisted content", children: <p>News may be collected from public sources, submitted by users or prepared by editors. AI tools can summarize, translate, classify or draft content, but they can make mistakes. Administrators may review, edit, delay, reject or remove content before publication. You should verify important information independently.</p> },
        { title: "Availability and third parties", children: <p>We work to keep the service available, but uninterrupted access is not guaranteed. Features may depend on Meta, Instagram, OpenAI, hosting, storage or other third-party services and may be limited, changed or temporarily unavailable.</p> },
        { title: "Content and intellectual property", children: <p>You keep responsibility for content you submit and must have the rights and permissions needed to submit it. The website, its branding, software and original editorial materials belong to their respective owners. Do not copy, modify, resell or redistribute protected materials without permission.</p> },
        { title: "Changes and contact", children: <p>We may update these terms as the service changes. Continued use after an update means you accept the revised terms. Contact us using the address shown below for questions or legal requests.</p> }
      ]}
    />
  );
}
