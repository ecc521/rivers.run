import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function SuggestEdit() {
  const { riverId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [submitting, setSubmitting] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  // Autofill email if user is signed in
  const [contactEmail, setContactEmail] = useState(user?.email || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) {
      alert("Please enter a suggestion.");
      return;
    }
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, "suggestions"), {
        riverId: riverId || "General",
        suggestion: suggestionText,
        submitterEmail: contactEmail,
        submitterUid: user?.uid || "anonymous",
        createdAt: new Date(),
        status: "pending"
      });

      // Insert to 'mail' collection to trigger Firebase "Trigger Email" Extension
      await addDoc(collection(db, "mail"), {
        to: ["tuckerwillenborg@gmail.com", "rewillen@gmail.com"],
        message: {
          subject: `New River Edit Suggestion for ${riverId}`,
          text: `A user has suggested an edit for ${riverId}.\n\nEmail: ${contactEmail}\n\nSuggestion:\n${suggestionText}\n\nReview it in the Firebase Console: https://console.firebase.google.com/u/0/project/rivers-run/firestore/data/~2Fsuggestions`
        }
      });
      alert("Thank you! Your suggestion has been sent to the editors.");
      navigate("/");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to submit: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content" style={{ maxWidth: 600, margin: "0 auto", paddingBottom: "100px" }}>
      <h1>Suggest an Edit for {riverId}</h1>
      
      <div style={{ backgroundColor: '#fff3cd', color: '#856404', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
        <strong>Note from the volunteers:</strong> Please make your suggestions explicitly clear and easy to copy/paste! We might not be familiar with this specific river ourselves, and we maintain this database essentially unpaid in our free time.
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div>
          <label style={{fontWeight: 'bold', display: 'block'}}>What should be changed?</label>
          <textarea 
            style={{ width: '100%', padding: '8px', minHeight: '150px' }} 
            placeholder="e.g. The take-out coordinates are wrong, they should be 38.92, -77.12. And the Class is actually III+."
            value={suggestionText} 
            onChange={e => setSuggestionText(e.target.value)} 
          />
        </div>

        <div>
          <label style={{fontWeight: 'bold', display: 'block'}}>Your Email (Optional, so we can follow up)</label>
          <input 
            type="email" 
            style={{ width: '100%', padding: '8px' }} 
            value={contactEmail} 
            onChange={e => setContactEmail(e.target.value)} 
            placeholder="paddler@example.com"
          />
        </div>

        <button 
          type="submit"
          disabled={submitting}
          style={{ padding: '15px', backgroundColor: '#317EFB', color: 'white', border: 'none', borderRadius: '5px', fontSize: '18px', cursor: 'pointer', marginTop: '10px' }}
        >
          {submitting ? "Submitting..." : "Send Suggestion"}
        </button>
      </form>
    </div>
  );
}
