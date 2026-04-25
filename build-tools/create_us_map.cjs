const fs = require('fs');
let svg = fs.readFileSync('src/components/Blank_US_Map.svg', 'utf8');

svg = svg.replace(/class=\"([a-z]{2})\"/g, 'id="$1" className={`state-path ${getStateStatus(\'$1\')}`} onClick={() => onStateClick(\'$1\')}');

// React-specific SVG fixes
svg = svg.replace(/<\?xml.*?\?>/g, '');
svg = svg.replace(/<!DOCTYPE.*?>/g, '');
svg = svg.replace(/xmlns:dc=".*?"/g, '');
svg = svg.replace(/xmlns:cc=".*?"/g, '');
svg = svg.replace(/xmlns:rdf=".*?"/g, '');
svg = svg.replace(/xmlns:svg=".*?"/g, '');
svg = svg.replace(/stroke-width/g, 'strokeWidth');
svg = svg.replace(/stroke-linejoin/g, 'strokeLinejoin');

// Fix the embedded <style> to JSX syntax or just remove it and use external CSS
// Let's remove the <style> block and we'll provide our own CSS.
svg = svg.replace(/<style type="text\/css">[\s\S]*?<\/style>/, '');

const componentStr = `import React from 'react';
import './InteractiveUSMap.css';

interface InteractiveUSMapProps {
  downloadedRegions: string[];
  downloadingRegionId: string | null;
  onStateClick: (stateAbbrev: string) => void;
}

export const InteractiveUSMap: React.FC<InteractiveUSMapProps> = ({ 
  downloadedRegions, 
  downloadingRegionId, 
  onStateClick 
}) => {
  const getStateStatus = (abbrev: string) => {
    const id = \`US-\${abbrev.toUpperCase()}\`;
    if (downloadingRegionId === id) return 'downloading';
    if (downloadedRegions.includes(id)) return 'downloaded';
    return 'none';
  };

  return (
    <div className="interactive-us-map-container">
      ${svg}
    </div>
  );
};
`;

fs.writeFileSync('src/components/InteractiveUSMap.tsx', componentStr);
fs.unlinkSync('src/components/Blank_US_Map.svg');
console.log('Created InteractiveUSMap.tsx');
