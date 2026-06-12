import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCommunityLists } from "../hooks/useCommunityLists";
import { useLists, type UserList } from "../context/ListsContext";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useModal } from "../context/ModalContext";
import { useSEO } from "../hooks/useSEO";
import { ListEditorModal } from "../components/ListEditorModal";
import { getShareBaseUrl } from "../utils/url";
import { Capacitor } from "@capacitor/core";

const ListsPage: React.FC = () => {
  const { user, isModerator, loading: authLoading } = useAuth();
  const { myLists, subscribedListIds, createList, updateList, toggleSubscription, isSubscribed } = useLists();
  const { homePageDefaultSearch, updateSetting } = useSettings();
  const { confirm, alert } = useModal();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "community" ? "community" : "mine";

  const setActiveTab = (tab: "mine" | "community") => {
      setSearchParams({ tab });
  };

  const { lists: communityLists, loading: communityLoading } = useCommunityLists();
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredAuthorListId, setHoveredAuthorListId] = useState<string | null>(null);

  const [editorModal, setEditorModal] = useState<{
    isOpen: boolean;
    mode: "create" | "edit" | "copy";
    initialTitle: string;
    initialDescription: string;
    targetList?: UserList;
  }>({
    isOpen: false,
    mode: "create",
    initialTitle: "",
    initialDescription: ""
  });

  useSEO({ title: "Rivers.run Lists", description: "Curated river itineraries from paddlers worldwide." });

  // Force tab to community if logged out
  useEffect(() => {
    if (!authLoading && !user && activeTab !== "community") {
      setSearchParams({ tab: "community" }, { replace: true });
    }
  }, [user, activeTab, authLoading, setSearchParams]);

  const searchTerms = searchQuery
    ? searchQuery.toLowerCase().split(/[ ,]+/).filter(t => t.length > 0)
    : [];

  const getListRelevanceScore = (list: UserList, terms: string[]) => {
    if (terms.length === 0) return 0;
    let score = 0;
    const lowerTitle = String(list.title || "").toLowerCase();
    const lowerAuthor = String(list.author || "").toLowerCase();
    const lowerDesc = String(list.description || "").toLowerCase();

    for (const t of terms) {
      if (lowerTitle === t) score += 100;
      else if (lowerTitle.startsWith(t)) score += 80;
      else if (lowerTitle.includes(t)) score += 40;

      if (lowerAuthor === t) score += 60;
      else if (lowerAuthor.startsWith(t)) score += 40;
      else if (lowerAuthor.includes(t)) score += 20;

      if (lowerDesc.includes(t)) score += 10;
    }
    return score;
  };

  const filteredCommunityLists = communityLists.filter(list => {
    if (searchTerms.length === 0) return true;
    const searchStr = `${list.title || ""} ${list.description || ""} ${list.author || ""}`.toLowerCase();
    return searchTerms.every(term => searchStr.includes(term));
  });

  if (searchTerms.length > 0) {
    filteredCommunityLists.sort((a, b) => {
      const aScore = getListRelevanceScore(a, searchTerms);
      const bScore = getListRelevanceScore(b, searchTerms);
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      return (b.subscribes || 0) - (a.subscribes || 0);
    });
  }

  const handleCreateList = async () => {
    const limit = isModerator ? 500 : 5;
    if (myLists.length >= limit) {
      await alert(`You have reached the limit of ${limit} custom lists.`);
      return;
    }
    setEditorModal({
      isOpen: true,
      mode: "create",
      initialTitle: "",
      initialDescription: ""
    });
  };

  const handleEditList = (list: UserList) => {
    setEditorModal({
      isOpen: true,
      mode: "edit",
      initialTitle: list.title,
      initialDescription: list.description || "",
      targetList: list
    });
  };

  const handleCopyList = async (list: UserList) => {
    const limit = isModerator ? 500 : 5;
    if (myLists.length >= limit) {
      await alert(`You have reached the limit of ${limit} custom lists. You cannot copy another list until you delete one of your own.`);
      return;
    }
    setEditorModal({
      isOpen: true,
      mode: "copy",
      initialTitle: `Copy of ${list.title}`,
      initialDescription: list.description || "",
      targetList: list
    });
  };

  const onSaveList = async (title: string, description: string) => {
    if (editorModal.mode === "create") {
      await createList(title, description, false);
    } else if (editorModal.mode === "edit" && editorModal.targetList) {
      await updateList(editorModal.targetList.id, { title, description });
    } else if (editorModal.mode === "copy" && editorModal.targetList) {
      // Create a new list with the target list's rivers
      await createList(title, description, false, editorModal.targetList.rivers);
      await alert("List copied successfully! It is now in 'My Lists'.");
      setActiveTab("mine");
    }
  };





  const handleToggleNotifications = async (list: UserList) => {
     try {
       await updateList(list.id, { notificationsEnabled: !list.notificationsEnabled });
       if (!list.notificationsEnabled) {
          await alert("Flow alerts enabled! You will be notified when rivers in this list pass your configured flow limits.");
       }
     } catch (err: unknown) {
       if (err instanceof Error) await alert(`Failed to toggle notifications: ${err.message}`);
     }
  };

  const renderListCard = (list: UserList) => {
    const isOwned = user ? list.ownerId === user.uid : false;
    const isAnonymous = list.author === "Anonymous Paddler" || !list.ownerId || list.ownerId === "";
    const otherLists = (list.ownerId && list.ownerId !== "" && !isAnonymous) 
      ? communityLists.filter(l => l.ownerId === list.ownerId && l.id !== list.id)
      : [];

    return (
      <div
        key={list.id}
        style={{
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          backgroundColor: "var(--surface)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          position: "relative"
        }}
      >
        <div style={{ position: "absolute", top: "15px", right: "15px", display: "flex", gap: "8px" }}>
            {user && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const isSub = isSubscribed(list.id);
                  if (!isSub && !isOwned) {
                      await alert("You must subscribe to this list before setting it as your default startup view.", "Subscribe First");
                      return;
                  }
                  
                  const isDefault = homePageDefaultSearch === `list:${list.id}`;
                  if (isDefault) {
                      updateSetting("homePageDefaultSearch", null);
                  } else {
                      if (await confirm(`Set "${list.title}" as your default startup view? It will load automatically whenever you open Rivers.run.`, "Set Default")) {
                          updateSetting("homePageDefaultSearch", `list:${list.id}`);
                      }
                  }
                }}
                title={homePageDefaultSearch === `list:${list.id}` ? "Remove as Default" : "Set as Default"}
                style={{ 
                  backgroundColor: homePageDefaultSearch === `list:${list.id}` ? "var(--primary)" : "var(--surface-hover)", 
                  border: "1px solid var(--border)", 
                  borderRadius: "50%", 
                  width: "36px", 
                  height: "36px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  cursor: "pointer",
                  fontSize: "1.2em",
                  color: homePageDefaultSearch === `list:${list.id}` ? "var(--surface)" : "var(--text-muted)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                {homePageDefaultSearch === `list:${list.id}` ? "★" : "☆"}
              </button>
            )}

            {isOwned && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  handleToggleNotifications(list);
                }}
                title={list.notificationsEnabled ? "Disable Email Alerts" : "Enable Email Alerts"}
                style={{ 
                  backgroundColor: list.notificationsEnabled ? "var(--primary)" : "var(--surface-hover)", 
                  border: "1px solid var(--border)", 
                  borderRadius: "50%", 
                  width: "36px", 
                  height: "36px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  cursor: "pointer",
                  fontSize: "1.1em",
                  color: list.notificationsEnabled ? "var(--surface)" : "var(--text-muted)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                {list.notificationsEnabled ? "🔔" : "🔕"}
              </button>
            )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingRight: "80px" }}>
          <div>
              <h2 style={{ margin: 0, color: "var(--text)", fontSize: "1.4em", display: "flex", alignItems: "center", gap: "10px" }}>
                 {list.title}
                 {isOwned && !list.isPublished && (
                    <span style={{ fontSize: "0.55em", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#334155", color: "white", textTransform: "uppercase" }}>Private</span>
                 )}
              </h2>
              <p style={{ margin: "5px 0 0 0", color: "var(--text-secondary)", fontStyle: "italic", fontSize: "0.9em", display: "flex", alignItems: "center", gap: "6px" }}>
                By{" "}
                {isAnonymous ? (
                  list.author
                ) : (
                  <span
                    onMouseEnter={() => setHoveredAuthorListId(list.id)}
                    onMouseLeave={() => setHoveredAuthorListId(null)}
                    style={{ position: "relative", display: "inline-block" }}
                  >
                    <span
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px dashed var(--text-secondary)",
                        fontWeight: 500,
                        color: "var(--text)"
                      }}
                    >
                      {list.author}
                    </span>
                    {hoveredAuthorListId === list.id && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: "0",
                          zIndex: 10,
                          paddingTop: "8px", // Bridges the gap to prevent mouse exit dead zone
                          cursor: "default",
                          fontStyle: "normal"
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent clicking within card from selecting the parent list card
                      >
                        <div
                          style={{
                            backgroundColor: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            padding: "12px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            width: "260px",
                            color: "var(--text)",
                            textAlign: "left"
                          }}
                        >
                          <div style={{ fontWeight: "bold", fontSize: "1.05em", marginBottom: "4px" }}>{list.author}</div>
                          <div style={{ fontSize: "0.85em", color: "var(--text-muted)", marginBottom: "10px" }}>
                            Role: <span style={{ 
                              fontWeight: "bold", 
                              color: list.authorRole === "admin" || list.authorRole === "super-admin" 
                                ? "var(--danger)" 
                                : list.authorRole === "moderator" 
                                  ? "var(--primary)" 
                                  : "var(--text-secondary)" 
                            }}>
                              {list.authorRole === "admin" || list.authorRole === "super-admin" 
                                ? "Administrator" 
                                : list.authorRole === "moderator" 
                                  ? "Moderator" 
                                  : "Paddler"}
                            </span>
                          </div>
                          
                          {otherLists.length > 0 && (
                            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                              <div style={{ fontSize: "0.85em", fontWeight: "bold", marginBottom: "6px", color: "var(--text-secondary)" }}>
                                Other Lists by Creator ({otherLists.length}):
                              </div>
                              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                                {otherLists.map(other => (
                                  <div 
                                    key={other.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/?list=${other.id}`);
                                      setHoveredAuthorListId(null);
                                    }}
                                    style={{
                                      fontSize: "0.85em",
                                      color: "var(--primary)",
                                      fontWeight: "normal",
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    }}
                                    title={other.title}
                                  >
                                    {other.title}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </span>
                )}
              </p>
          </div>
          <span style={{ backgroundColor: "var(--surface-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", padding: "4px 8px", borderRadius: "12px", fontSize: "0.85em", fontWeight: "bold" }}>
             {list.subscribes || 0} Subscribers
          </span>
        </div>
        
        <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: "1.5" }}>{list.description || "No description provided."}</p>
        
        <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.9em" }}>
          Contains {list.rivers?.length || 0} River Sections
        </p>

        {list.notificationsEnabled && list.rivers?.length > 0 && (
           <div style={{ padding: "8px 12px", backgroundColor: "var(--surface-hover)", borderRadius: "6px", border: "1px solid var(--primary)", borderLeftWidth: "4px" }}>
             <p style={{ margin: 0, fontSize: "0.85em", fontWeight: "bold", color: "var(--primary)" }}>
                🔔 {list.rivers.filter(r => r.gaugeId).length} Active Pinned Alerts
             </p>
             <p style={{ margin: "2px 0 0 0", fontSize: "0.8em", color: "var(--text-muted)" }}>
                Pinned to specific sensors at time of addition.
             </p>
           </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => navigate(`/?list=${list.id}`)}
              style={{ padding: "8px 16px", backgroundColor: "var(--primary)", color: "var(--surface)", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
            >
              View List
            </button>

            {user && (
                <button
                   onClick={() => handleEditList(list)}
                   style={{ padding: "8px 16px", backgroundColor: "var(--surface-hover)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                >
                   Manage List
                </button>
            )}

            <button
               onClick={async () => {
                  const url = `${getShareBaseUrl("/")}?list=${list.id}`;
                  if (Capacitor.isNativePlatform() && navigator.share) {
                      try {
                          await navigator.share({
                              title: list.title,
                              text: list.description,
                              url: url
                          });
                      } catch (err) {
                          console.warn("Share failed", err);
                      }
                  } else {
                      try {
                          await navigator.clipboard.writeText(url);
                          await alert("Link copied to clipboard!");
                      } catch (err) {
                          console.error("Clipboard copy failed", err);
                          await alert("Failed to copy link. Please manually copy the URL.", "Error");
                      }
                  }
               }}
               style={{ padding: "8px 16px", backgroundColor: "var(--surface-hover)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
            >
               <span>🔗</span> Share
            </button>

            {user && !isOwned && (
                <button
                   onClick={async () => {
                      const willSubscribe = !isSubscribed(list.id);
                      await toggleSubscription(list.id);
                      if (willSubscribe) {
                          await alert(`You are now subscribed to "${list.title}"! ${list.notificationsEnabled ? "Since the author has Alerts enabled, you will also receive daily email digests when these rivers are running." : ""}`, "Subscribed");
                      } else {
                          await alert(`You have unsubscribed from "${list.title}".`, "Unsubscribed");
                      }
                   }}
                   style={{ padding: "8px 16px", backgroundColor: isSubscribed(list.id) ? "var(--primary)" : "var(--surface-hover)", color: isSubscribed(list.id) ? "var(--surface)" : "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}
                >
                   {isSubscribed(list.id) ? "Unsubscribe" : "Subscribe"}
                </button>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content" style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
      <h1 className="center" style={{ marginBottom: "10px" }}>
        Rivers.run Lists
      </h1>
      <p className="center" style={{ color: "var(--text-muted)", marginBottom: "30px", fontSize: "1.1rem" }}>
        Build, share, and discover river itineraries.
      </p>

      {user && (
         <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px", gap: "10px", flexWrap: "wrap" }}>
           <button 
             onClick={() => setActiveTab("mine")}
             style={{ padding: "10px 20px", borderRadius: "20px", border: "none", fontWeight: "bold", cursor: "pointer", backgroundColor: activeTab === "mine" ? "var(--primary)" : "var(--surface-hover)", color: activeTab === "mine" ? "var(--surface)" : "var(--text)" }}
           >
             My Lists
           </button>
           <button 
             onClick={() => setActiveTab("community")}
             style={{ padding: "10px 20px", borderRadius: "20px", border: "none", fontWeight: "bold", cursor: "pointer", backgroundColor: activeTab === "community" ? "var(--primary)" : "var(--surface-hover)", color: activeTab === "community" ? "var(--surface)" : "var(--text)" }}
           >
             Community
           </button>
         </div>
      )}

      {/* Startup View Setting Shortcut */}
      <div style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "15px", marginBottom: "30px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "15px" }}>
         <div>
            <h3 style={{ margin: "0 0 5px 0", fontSize: "1.1em" }}>App Startup View</h3>
            <p style={{ margin: 0, fontSize: "0.9em", color: "var(--text-muted)" }}>Choose what loads by default when you open Rivers.run.</p>
         </div>
         <select
            value={homePageDefaultSearch || "null"}
            onChange={(e) => updateSetting("homePageDefaultSearch", e.target.value)}
            style={{ padding: "8px", borderRadius: "6px", fontSize: "1rem", backgroundColor: "var(--surface-hover)", color: "var(--text)", border: "1px solid var(--border)", minWidth: "200px" }}
         >
            <option value="null">None (Display All Rivers)</option>
            {user && (
               <optgroup label="My Custom Lists">
                 {myLists.map(list => (
                    <option key={list.id} value={`list:${list.id}`}>List: {list.title}</option>
                 ))}
               </optgroup>
            )}
            {subscribedListIds.length > 0 && (
               <optgroup label="Subscribed Lists">
                  {communityLists.filter(list => subscribedListIds.includes(list.id)).map(list => (
                     <option key={list.id} value={`list:${list.id}`}>List: {list.title}</option>
                  ))}
               </optgroup>
            )}
         </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {activeTab === "mine" && (
           <>
             {myLists.length > 0 && (
                 <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", marginBottom: "10px" }}>
                    <h3 style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: "0.95em", letterSpacing: "1px" }}>My Lists ({myLists.length}/{isModerator ? "Unlimited" : "5"})</h3>
                 </div>
             )}

             {myLists.map(l => renderListCard(l))}
             {myLists.length < (isModerator ? 500 : 5) && (
                 <button onClick={handleCreateList} style={{ padding: "15px", border: "2px dashed var(--border)", borderRadius: "8px", backgroundColor: "transparent", color: "var(--primary)", fontWeight: "bold", fontSize: "1.1em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginTop: "5px" }}>
                    <span>+</span> Create New List
                 </button>
             )}

             <div style={{ marginTop: "30px", marginBottom: "10px", display: "flex", alignItems: "center" }}>
                <h3 style={{ margin: 0, color: "var(--text-secondary)", textTransform: "uppercase", fontSize: "0.95em", letterSpacing: "1px" }}>Subscriptions</h3>
             </div>

             {communityLoading ? (
                 <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Loading subscriptions...</div>
             ) : (
                 <>
                   {communityLists.filter(l => subscribedListIds.includes(l.id)).map(l => renderListCard(l))}
                   {communityLists.filter(l => subscribedListIds.includes(l.id)).length === 0 && (
                      <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", backgroundColor: "var(--surface)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                        You haven't subscribed to any community lists.
                      </div>
                   )}
                 </>
             )}
           </>
        )}

        {activeTab === "community" && (
           <>
             <div style={{ marginBottom: "20px" }}>
                 <input 
                    type="search" 
                    placeholder="Search by list name, description, or author..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ 
                        width: "100%", 
                        padding: "15px", 
                        borderRadius: "8px", 
                        border: "1px solid var(--border)", 
                        backgroundColor: "var(--surface)", 
                        color: "var(--text)",
                        fontSize: "1.1em",
                        boxSizing: "border-box"
                    }}
                 />
             </div>

             {communityLoading ? (
                 <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>Loading community lists natively...</div>
             ) : (
                 <>
                   {filteredCommunityLists.map(l => renderListCard(l as unknown as UserList))}
                   {filteredCommunityLists.length === 0 && (
                      <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        {searchQuery ? "No published lists match your search criteria." : "No community lists published yet!"}
                      </div>
                   )}
                 </>
             )}
           </>
        )}

      </div>

      <ListEditorModal 
         isOpen={editorModal.isOpen}
         mode={editorModal.mode as any}
         initialTitle={editorModal.initialTitle}
         initialDescription={editorModal.initialDescription}
         targetList={editorModal.targetList}
         onClose={() => setEditorModal(prev => ({ ...prev, isOpen: false }))}
         onSave={onSaveList}
         onCopySharedList={handleCopyList}
      />
    </div>
  );
};

export default ListsPage;
