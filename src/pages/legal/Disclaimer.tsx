import React from "react";
import { LegalLayout } from "./LegalLayout";

const Disclaimer: React.FC = () => {
  return (
    <LegalLayout title="Disclaimer">
      <p>This site has user generated content. <strong>No guarantee can be made for the accuracy of completeness of content.
      Your use of this content is AT YOUR OWN RISK.</strong></p>
      
      <p>This site may provide water levels that rivers are "runnable" at. <strong><i>Just because a river is deemed "running" does not mean that the river is safe for you, or anybody, to run.</i></strong></p>

      <p>River conditions (Such as Gauge Height, Flow Rate, Precipitation, and Temperature) can change without warning, and <strong>may be incorrect</strong>.</p>
      
      <h3>More info about gauges: </h3>
      <ul style={{ listStylePosition: "inside", paddingLeft: 0 }}>
        <li>Virtual gauges are NOT real gauges - they are values calculated based off of other gauges. Almost all virtual gauges <strong>will fail to provide accurate data</strong> under certain conditions.</li>
        <li>USGS Flow Data is Provisional - Read more about provisional data at <a href="https://water.usgs.gov/data/provisional.html" style={{ color: "#3b82f6", textDecoration: "none" }}>USGS (United States Geological Survey)</a>.</li>
      </ul>

      <p style={{ fontSize: "1.5rem", fontWeight: "bold", textAlign: "center", margin: "30px 0" }}>
        YOU should make the final decision whether to go on a river or not.
      </p>

      <p style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
        IN ABSOLUTELY NO EVENT SHALL THE AUTHORS, ADMINISTRATORS, COPYRIGHT HOLDERS, DEVELOPERS, AND/OR CONTRIBUTORS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH <a href="/" style={{ color: "#3b82f6", textDecoration: "none" }}>RIVERS.RUN, AND/OR IT'S SUBDOMAINS.</a>
      </p>
    </LegalLayout>
  );
};

export default Disclaimer;
