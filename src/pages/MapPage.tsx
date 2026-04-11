import React, { useEffect, useState } from "react";
import { useLocation } from "../hooks/useLocation";
import { useRivers } from "../hooks/useRivers";
import { SharedMap } from "../components/SharedMap";

const MapPage: React.FC = () => {
  const location = useLocation();
  const { loading: riversLoading, error: riversError } = useRivers();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync internal loading state with rivers data hook
  useEffect(() => {
     if (riversLoading) {
         setLoading(true);
     } else {
         setLoading(false);
         if (riversError) setError(riversError);
     }
  }, [riversLoading, riversError]);

  useEffect(() => {
    // Automatically query for user location to place native tracker token
    location.requestLocation({ enableHighAccuracy: true });
  }, []);

  if (loading)
    return (
      <div className="page-content center">
        <h2>Loading Map Data...</h2>
      </div>
    );
  if (error)
    return (
      <div className="page-content center">
        <h2>Error loading map: {error}</h2>
      </div>
    );

  return <SharedMap height="calc(100vh - 60px)" />;
};

export default MapPage;
