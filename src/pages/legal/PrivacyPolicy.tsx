import React from "react";
import { LegalLayout } from "./LegalLayout";

const PrivacyPolicy: React.FC = () => {
  return (
    <LegalLayout title="Privacy Policy">
      <h2>Information We Collect or Store</h2>
      <p>If you choose to create an account, Rivers.run stores the profile information you provide or authorize (such as your email address, display name, and profile picture). We also store your account preferences and saved favorite rivers. If you use the app as a guest without creating an account, Rivers.run does not directly store any personal information about you.</p>

      <h2>Location Services</h2>
      <p>Rivers.run utilizes your device's GPS and location services to calculate distances to rivers and display your position on the map. This location data is processed locally on your device and is <strong>never</strong> transmitted to our servers or stored centrally.</p>

      <h2>User-Generated Content</h2>
      <p>If you choose to use features such as creating community lists, suggesting clubs, or submitting river details, that data is public. Any content you voluntarily submit will be visible to other Rivers.run users.</p>

      <h2>Third Parties & Analytics</h2>
      <p>Rivers.run uses Firebase to manage user authentication, store your favorite rivers, and host public community content. Firebase is also used for analytics.</p>
      <p>Firebase typically collects technical information such as pages viewed, time spent in the app, and device IDs to determine unique users.</p>
      <p>Rivers.run does not sell this information or share it with any other parties outside of the standard infrastructure providers necessary to run the service.</p>

      <h2>Data Deletion</h2>
      <p>You have full control over your data. You can delete your account at any time using the "Delete Account" option found in the Global Navigation bar profile dropdown. Deleting your Rivers.run account will permanently and immediately delete your saved login details, your profile, and your favorite rivers.</p>

      <h2 id="changes">Changes to This Privacy Policy</h2>
      <p>We reserve the right to modify this policy at any time. Changes become effective 30 days after posting of an updated version of this policy to the App or Website. Continued use of Rivers.run after any such changes become effective shall constitute your consent to such changes.</p>

      <h2 id="contact">Contact Us</h2>
      <p>If you have any questions about this privacy policy, feel free to contact us. You can send us an email at <a href="mailto:support@rivers.run" style={{ color: "var(--primary)", textDecoration: "none" }}>support@rivers.run</a></p>
    </LegalLayout>
  );
};

export default PrivacyPolicy;
