# Firebase Blaze Plan Free Tier Quotas

Rivers.run runs on the Firebase **Blaze (Pay As You Go)** plan. While the Spark (Free) plan has hard cutoff limits, the Blaze plan includes a generous "always free" tier for most services, but will begin automatically charging you once exceeded.

It is critically important to monitor these thresholds to ensure we stay under the free limits.

## 1. Cloud Firestore
*   **Document Reads:** 50,000 per day
*   **Document Writes:** 20,000 per day
*   **Document Deletes:** 20,000 per day
*   **Stored Data:** 1 GiB total
> **Strategy for Rivers.run:** We leverage `public/riverdata.json` and `public/flowdata3.json` payload synchronization to push all the heavy lifting to Cloud Storage instead of paying computationally for Firestore reads on every map load.

## 2. Cloud Storage
*   **Stored Data:** 5 GB total
*   **Downloaded Data (Bandwidth):** 1 GB per day (30 GB / month)
*   **Upload Operations:** 20,000 per day
*   **Download Operations:** 50,000 per day
> **Strategy for Rivers.run:** The main flow payload `flowdata3.json` utilizes native `zlib` GZIP compression to aggressively map data down before storage. Further optimizing how frequently the client checks for an updated cache header significantly reduces our bandwidth imprint.

## 3. Cloud Functions (Node.js)
*   **Invocations:** 2,000,000 per month
*   **Compute Time:** 400,000 GB-seconds and 200,000 CPU-seconds per month
*   **Networking (Outbound):** 5 GB per month free
*   **NOTE:** Since we use GCP APIs externally, Google Cloud natively bills out-of-ecosystem network egress. However, USGS and Canadian sites are typically highly lightweight text forms.

## 4. Firebase Hosting
*   **Stored Data:** 10 GB total
*   **Downloaded Data (Bandwidth):** 10 GB per month (approx 360 MB per day)

## 5. Authentication
*   **Traditional Logins (Email/Google/Apple):** 50,000 Monthly Active Users (MAUs) free
*   **Phone Verification:** 10/month free (usually irrelevant for rivers.run)

## Best Practices
1. **Never loop unstructured Firestore Queries:** Always utilize `limit()` or edge collections!
2. **Observe the Scheduled Sync:** Ensure the Cloud Function for scraping flow data runs sequentially and securely. Polling every 15 minutes is fine, but aggressive 1-minute polling can blow past the compute or egress caps quickly. 
3. **Monitor the Usage Tab:** Check the Firebase Console > Usage widget weekly to ensure no regressions cause an unexpected spike.
