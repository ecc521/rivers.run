import React from "react";

export const ContactSupport: React.FC = () => (
  <p>
    You can also email{" "}
    <a href="mailto:support@rivers.run" target="_blank" rel="noreferrer">
      support@rivers.run
    </a>{" "}
    telling us what you would like to be changed or added.
  </p>
);

export const ContactAdmin: React.FC = () => (
  <p>
    If you would like permission to edit directly, approve edits, add
    rivers, and confirm river additions, please email{" "}
    <a href="mailto:support@rivers.run" target="_blank" rel="noreferrer">
      support@rivers.run
    </a>
    .
  </p>
);
