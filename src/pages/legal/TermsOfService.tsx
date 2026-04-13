import React from "react";
import { LegalLayout } from "./LegalLayout";

const TermsOfService: React.FC = () => {
  return (
    <LegalLayout title="Terms and Conditions">
      <p>These terms and conditions ("Terms", "Agreement") are an agreement between the operator of Rivers.run, acting as an individual ("Rivers.run", "us", "we" or "our"), and you ("User", "you" or "your"). This Agreement sets forth the general terms and conditions of your use of the{" "}
      <a href="/" style={{ color: "var(--primary)", textDecoration: "none" }}>rivers.run</a> website, mobile applications, and any of its related products or services (collectively, "Services").</p>
      
      <h2>Accounts and Membership</h2>
      <p>If you create an account on the Services, you are responsible for maintaining the security of your account and you are fully responsible for all activities that occur under the account. We may, but have no obligation to, monitor and review new accounts. You must immediately notify us of any unauthorized uses of your account or any other breaches of security. We may suspend, disable, or delete your account (or any part thereof) if we determine that you have violated any provision of this Agreement or that your conduct would tend to damage our reputation and goodwill.</p>
      
      <h2>User Generated Content and Licensing</h2>
      <p>You retain ownership of any data, information, or material ("Content") that you submit to Rivers.run (such as river suggestions, community lists, and club definitions). However, by submitting Content to Rivers.run, you grant us a worldwide, irrevocable, perpetual, non-exclusive, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform the Content in connection with the Services and our business operations.</p>
      <p>You shall have sole responsibility for the accuracy, legality, and intellectual property ownership of all submitted Content. As a provider of an interactive computer service, we reserve the absolute right and discretion to edit, modify, reject, or remove any Content you submit—for any reason or no reason whatsoever, without notice. We are not obligated to publish, host, or retain any submissions, even if they comply with all policies and are factually accurate.</p>
      
      <h2>Backups</h2>
      <p>We are not responsible for Content residing on the Services. In no event shall we be held liable for any loss of any Content. The Services provide an option to download your account data (lists) locally. It is your sole responsibility to maintain appropriate backup of your Content.</p>
      
      <h2>Links to Other Resources</h2>
      <p>Although the Services may link to other websites or resources, we are not, directly or indirectly, implying any approval, association, sponsorship, endorsement, or affiliation with any linked resource. Your linking to any other off-site resources is at your own risk.</p>
      
      <h2>Prohibited Uses</h2>
      <p>In addition to other terms as set forth in the Agreement, you are prohibited from using the Services or its Content: (a) for any unlawful purpose; (b) to solicit others to perform or participate in any unlawful acts; (c) to violate any regulations, rules, or laws; (d) to infringe upon or violate our intellectual property rights or the intellectual property rights of others; (e) to collect or track the personal information of others; (f) to spam, phish, pharm, pretext, spider, crawl, or scrape; or (g) to interfere with or circumvent the security features of the Services. We reserve the right to terminate your use of the Services for violating any of the prohibited uses.</p>
      
      <h2>Intellectual Property Rights</h2>
      <p>This Agreement does not transfer to you any intellectual property owned by Rivers.run or third-parties, and all rights, titles, and interests in and to such property will remain solely with Rivers.run and its licensors. All trademarks, service marks, graphics and logos used in connection with our Services are trademarks or registered trademarks of Rivers.run or its licensors. Rivers.run is independently developed and operated.</p>
      
      <h2>Limitation of Liability</h2>
      <p>To the fullest extent permitted by applicable law, in no event will Rivers.run or its operator be liable to any person for any indirect, incidental, special, punitive, cover or consequential damages (including, without limitation, damages for lost profits, revenue, risk of personal injury resulting from using the Services navigation, data, or content loss) however caused, under any theory of liability, including contract, tort, warranty, negligence or otherwise, even if Rivers.run has been advised as to the possibility of such damages.</p>
      
      <h2>Indemnification</h2>
      <p>You agree to indemnify and hold Rivers.run, its operator, and affiliates harmless from and against any liabilities, losses, damages or costs, including reasonable attorneys' fees, incurred in connection with or arising from any third-party allegations, claims, actions, disputes, or demands asserted against them as a result of or relating to your Content, your use of the Services, or any willful misconduct on your part.</p>
      
      <h2>Dispute Resolution</h2>
      <p>The formation, interpretation, and performance of this Agreement and any disputes arising out of it shall be governed by the substantive and procedural laws of North Carolina, United States without regard to its rules on conflicts or choice of law. The exclusive jurisdiction and venue for actions related to the subject matter hereof shall be the state and federal courts located in North Carolina, United States, and you hereby submit to the personal jurisdiction of such courts.</p>
      
      <h2>Changes and Amendments</h2>
      <p>We reserve the right to modify this Agreement or its policies relating to the Services at any time. Changes become effective 30 days after posting of an updated version of this Agreement. Continued use of the Services after any such changes become effective shall constitute your consent to such changes.</p>
      
      <h2>Contacting Us</h2>
      <p>If you would like to contact us to understand more about this Agreement or wish to contact us concerning any matter relating to it, you may send an email to support@rivers.run</p>
    </LegalLayout>
  );
};

export default TermsOfService;
