import React, { useState } from "react";
import { Link } from "react-router-dom";

const ClubSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        marginBottom: "15px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--border, #e2e8f0)",
        background: "var(--surface, #ffffff)",
      }}
    >
      <button
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        style={{
          width: "100%",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--surface-hover, #f8fafc)",
          border: "none",
          cursor: "pointer",
          fontSize: "1.2rem",
          fontWeight: 600,
          textAlign: "left",
          color: "var(--text, #1e293b)",
        }}
      >
        {title}
        <span
          style={{
            fontSize: "1.5rem",
            color: isOpen ? "var(--danger)" : "var(--primary)",
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "none",
          }}
        >
          ▼
        </span>
      </button>
      {isOpen && (
        <div
          style={{
            padding: "20px",
            color: "var(--text-secondary, #475569)",
            lineHeight: "1.6",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const Clubs: React.FC = () => {
  return (
    <div
      className="page-content"
      style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}
    >
      <h1 className="center" style={{ marginBottom: "10px" }}>
        Clubs and Regional Expertise
      </h1>
      <p
        className="center"
        style={{
          color: "var(--text-secondary, #64748b)",
          marginBottom: "30px",
          fontSize: "1.1rem",
        }}
      >
        Regional paddling clubs and their experts provide a wealth of river
        information.
        <br />
        This page consolidates local and regional rivers and expertise.
      </p>

      <div
        style={{
          backgroundColor: "var(--alert-bg, #eff6ff)",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid var(--alert-border, #bfdbfe)",
          marginBottom: "40px",
        }}
      >
        <p style={{ margin: "0 0 10px 0" }}>
          The lists are maintained using rivers.run tag capabilities. There are
          a number of tags already in place (CCCWOR, CCCSPRING, WVWOR) that work
          in conjunction with free form search queries.
        </p>
        <p style={{ margin: "0 0 10px 0" }}>
          To take full advantage of any search result, simply search for the tag
          on the main page, then hit the skill arrow to sort by difficulty, or
          the flow arrow to get a consolidated view of what's running.
        </p>
        <p style={{ margin: 0, fontWeight: "bold" }}>
          If you are interested in adding your local expertise or an events
          summary, please email{" "}
          <a href="mailto:contact@rivers.run">contact@rivers.run</a>
        </p>
      </div>

      <h2
        style={{
          marginBottom: "20px",
          color: "var(--text, #1e293b)",
          paddingBottom: "10px",
          borderBottom: "2px solid var(--border, #e2e8f0)",
        }}
      >
        Paddling Club Events (Commonly Paddled)
      </h2>
      <ul
        style={{ marginBottom: "40px", lineHeight: "1.8", fontSize: "1.1em" }}
      >
        <li>
          <Link to="/?search=WVWOR">
            April - West Virginia Week of Rivers (tag = WVWOR)
          </Link>
        </li>
        <li>
          <Link to="/?search=CCCSPRING">
            Easter - Carolina Canoe Club Spring weekend (tag = CCCSPRING)
          </Link>
        </li>
        <li>
          <Link to="/?search=CCCWOR">
            July - Carolina Canoe Club Week of Rivers
          </Link>
        </li>
      </ul>

      <h2
        style={{
          marginBottom: "20px",
          color: "var(--text, #1e293b)",
          paddingBottom: "10px",
          borderBottom: "2px solid var(--border, #e2e8f0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Learn from the Experts (Ed Evangelidi)</span>
      </h2>
      <p style={{ marginBottom: "20px" }}>
        Paddlers in the WV/VA/MD and surrounding areas have drawn from Ed's
        knowledge of the rivers for decades. Here are some of Ed's curated
        favorites lists:
      </p>

      <ClubSection
        title="Ed's Ranked River List (Expert -> Novice)"
        defaultOpen={false}
      >
        <p>
          This list, and a similar ranked list from Monocacy Club, provides a
          nice way to find rivers most likely within your paddling skill range.
        </p>
        <p>
          <strong>HOW TO USE THE RANKING CHART:</strong> Mark the river sections
          that you have done. These are the rivers that you should be familiar
          with. Then compare an unpaddled river that you may be contemplating.
          If the new river is higher than you have previously done, be cautious!
        </p>

        <h3 style={{ marginTop: "20px" }}>Expert</h3>
        <ol style={{ lineHeight: "1.6" }}>
          <li>Lower Meadow, WV</li>
          <li>Blackwater Canyon, WV 250CFS</li>
          <li>Great Falls, Potomac (VA & MD)</li>
          <li>Upper Yough @&gt;3', SangRun @1.5-2'</li>
          <li>Upper Shavers Fork, WV</li>
          <li>Watauga Gorge</li>
          <li>Upper Gauley, WV [Release Level]</li>
          <li>Lower Big Sandy, WV Rockville&gt;6'</li>
          <li>Chatooga Section 4</li>
          <li>Top Yough, MD</li>
          <li>Stony Creek, WV [Upper & Lower]</li>
        </ol>

        <h3 style={{ marginTop: "20px" }}>Advanced</h3>
        <ol style={{ lineHeight: "1.6" }} start={12}>
          <li>Middle Fork Tygart, WV 4' Belington</li>
          <li>Tygart Gorge, WV Belington @3.5</li>
          <li>Lower Moose River (N.Y.)</li>
          <li>Upper Tellico</li>
          <li>John's Creek, VA</li>
          <li>Kitzmiller, N.Br., @ 4-5' MD/WV</li>
          <li>Lower Gauley, 2400 CFS WV</li>
          <li>Chauga Gorge</li>
          <li>Tygart, Arden Section, WV Phil @2.5'</li>
          <li>New River Gorge @&gt;1', WV</li>
          <li>Cheat Canyon @&gt;3', WV</li>
          <li>Gooney Run @ 6", VA</li>
          <li>Lower Bear Creek, MD 250CFS</li>
          <li>Savage River @ 1000CFS, MD</li>
          <li>Georges Creek, MD</li>
          <li>Buckhannon River, (Alton-Sago) WV</li>
          <li>Maury River/Goshen, VA</li>
          <li>Laurel Fork, Cheat, &gt;1' WV</li>
          <li>Wills Creek, below Fairhope PA @4'</li>
          <li>Ocoee</li>
          <li>New River Dries, WV</li>
          <li>Upper Stonycreek, PA (above US 33)</li>
        </ol>

        <h3 style={{ marginTop: "20px" }}>Intermediate</h3>
        <ol style={{ lineHeight: "1.6" }} start={34}>
          <li>Cranberry or Williams, WV</li>
          <li>Upper Meadow, WV</li>
          <li>Big Laurel Creek</li>
          <li>Upper Big Sandy, @6.5, WV</li>
          <li>Little Sandy, WV</li>
          <li>Chatooga Section 3</li>
          <li>Lower Yough, @&gt; 2.5' PA</li>
          <li>Trout Run, WV</li>
          <li>Middle Fork of the Salmon in Idaho</li>
          <li>Lower Tellico (350 CFS)</li>
          <li>Nolichucky</li>
          <li>Seneca Creek or Red Creek, WV</li>
          <li>Stonycreek, PA @ 2' Holsopple</li>
          <li>Shavers Fork, Bemis/Bowden, WV</li>
          <li>Loyalsock River, PA</li>
          <li>Lost River Gorge @ 1', WV</li>
          <li>French Broad</li>
          <li>James River fall line @&gt; 5.5', VA</li>
          <li>Upper Tye, VA 250CFS</li>
          <li>Bullpasture Gorge, VA BV @ 2.9'</li>
          <li>North River Gorge, VA</li>
          <li>Upper Conway, VA</li>
          <li>Little Falls, Potomac @&gt;3.1', MD</li>
          <li>S. Fk. Hardware River, VA</li>
          <li>Moorefield Canyon, WV</li>
          <li>Smokehole Canyon, WV</li>
          <li>Brush Creek, PA</li>
          <li>Middle Meadow @ 500 CFS, WV</li>
          <li>Blacklick Creek, PA @ 4' Josep.</li>
          <li>Tohickon Creek, PA @ normal release</li>
          <li>Upper Rapidan, (above Wolftown) VA</li>
          <li>Shade Creek, PA</li>
          <li>Pigeon River (below dam release)</li>
          <li>Rock Creek, DC (below Military Rd)</li>
          <li>North River, above Rio WV</li>
          <li>Slippery Rock Creek, PA</li>
          <li>Covington River @ 1' P.I., VA</li>
          <li>Cub Run fall line @&gt; 6", VA</li>
          <li>Dry Fork, Cheat @ 3' Hendrix, WV</li>
          <li>Clear Shade Creek, PA</li>
          <li>Hopeville Canyon, WV</li>
          <li>Nantahala River</li>
          <li>Pohick Creek, VA</li>
          <li>Cheat Narrows, WV @ 2' Albright</li>
          <li>Sligo Creek (Maple-N.H. Ave) MD</li>
          <li>Cabin John Creek, MD</li>
          <li>Bloomington, Pot. @&gt;1100 CFS, MD/WV</li>
          <li>Passage Creek, @ 6" VA</li>
          <li>
            <Link to="/?search=shenandoah">
              Shenandoah Staircase @&gt;2.5', WV/VA/MD
            </Link>
          </li>
          <li>Casselman River, [Fort Hill] PA</li>
          <li>Dry Fork, US 33-Jenningston, WV</li>
          <li>Lower Gunpowder, MD @&gt;6"</li>
          <li>Little Gunpowder, MD</li>
          <li>Muddy Creek, PA @ &gt;1'</li>
          <li>Cartacay River</li>
          <li>Little Patuxent R./Savage MD</li>
          <li>Lehigh Gorge @ &gt;1000 CFS, PA</li>
          <li>Patapsco R., above Ellicott City</li>
          <li>Rush River, VA @ 6"</li>
          <li>Mather Gorge, Potomac VA/MD @&gt;4'</li>
          <li>North Anna fall line, VA @&gt;1'</li>
          <li>Rappahannock fall line, VA @&gt;1'</li>
          <li>Marsh Creek, PA @ 6"</li>
          <li>Glady Fork, WV</li>
          <li>S.Br. Patapsco, MD (Gaither Gorge)</li>
          <li>S.Br. Potomac, Petersburg Sect., WV</li>
          <li>James River, Balcony Falls, VA</li>
          <li>Northwest Branch, Anacostia R. MD</li>
          <li>Nescopek Creek, PA</li>
          <li>Codorus Creek, PA</li>
          <li>Big Cove Creek, PA</li>
        </ol>

        <h3 style={{ marginTop: "20px" }}>Novice/Intermediate</h3>
        <ol style={{ lineHeight: "1.6" }} start={105}>
          <li>New River, Prince to Cunard, WV</li>
          <li>Robinson River, VA</li>
          <li>Middle Creek, PA @ 3"</li>
          <li>Appomattox River, VA @ 6" P.I.</li>
          <li>Upper Dry Fork, Cheat WV</li>
          <li>Aquia Creek, VA</li>
          <li>Quemahoning Creek, PA</li>
          <li>15 Mile Creek, MD @ 3"</li>
          <li>Laurel Hill Creek, PA</li>
          <li>Rappahannock/Kelly's Ford, VA @5'</li>
          <li>N.Br. Potomac, Bloomington/Keyser</li>
          <li>Maury River, Lower, VA</li>
          <li>Potomac, Needles Section, MD</li>
          <li>Tuckaseigee</li>
          <li>Pine Creek Gorge, PA</li>
          <li>Octoraro Creek, PA/MD</li>
          <li>Thornton River, VA</li>
          <li>Hiawassee River (below dam)</li>
          <li>Hughes/Hazel River, VA @ 6"</li>
          <li>Little Seneca Creek, MD</li>
          <li>Lower Shavers Fork, Cheat WV @ 3"</li>
          <li>Cacapon River, rt.50/rt.127, WV @ 6"</li>
        </ol>

        <h3 style={{ marginTop: "20px" }}>Novice</h3>
        <ol style={{ lineHeight: "1.6" }} start={127}>
          <li>Rap. Rap. rivers, VA</li>
          <li>South River, Shenandoah, VA</li>
          <li>Upper Muddy Creek, PA</li>
          <li>Paw Paw Section, Potomac, MD</li>
          <li>Middle Yough, PA @ 2' Ohiopyle</li>
          <li>Goose Creek/Golf Course run, VA</li>
          <li>Cedar Creek, VA</li>
          <li>N. Fk. Shenandoah @ Cootes Store</li>
          <li>Catoctin Creek, VA</li>
          <li>Antietam Creek, MD @&gt;3'</li>
          <li>Sideling Hill Creek, MD</li>
          <li>Violettes Lock, Potomac MD/VA @&gt;5'</li>
          <li>Lost River, WV above rt. 55 br.</li>
          <li>Rappahannock above rt. 211, VA</li>
          <li>Compton section, Shenandoah R., VA</li>
          <li>Newport to Luray, Shenandoah R., VA</li>
          <li>Catoctin Creek, MD</li>
          <li>Deer Creek, MD (NOT Rocks section)</li>
          <li>Conococheague Creek, PA (PA only)</li>
          <li>S.Br. Potomac Trough, WV</li>
          <li>South Anna River (fall line), VA</li>
          <li>Upper Rock Creek, MD/DC</li>
          <li>Upper Gunpowder, MD (Masem.-Monkton)</li>
          <li>Difficult Run, VA (rt. 7 to rt.123)</li>
          <li>Sleepy Creek, WV</li>
          <li>Seneca Creek, MD @&gt;2.5'</li>
          <li>Upper Goose Creek, VA</li>
          <li>Monocacy River, MD @&gt;2.5'</li>
          <li>Mattaponi River/Pamunkey River, VA</li>
          <li>Opequon Creek, VA/WV</li>
        </ol>
      </ClubSection>

      <ClubSection title="Ed's Top DC Area Runs">
        <p>
          Pick a skill level and see if you have paddled all of the most popular
          rivers in your interest group. You have some claim to braggin' rights
          if you have first hand knowledge of the best water that this area has
          to offer.
        </p>
        <p>
          <em>(Search tag: `edtop`)</em>
        </p>

        <h4>Expert (5 primo runs)</h4>
        <ul style={{ listStyleType: "square" }}>
          <li>Upper Yough or Top Yough</li>
          <li>Upper Gauley</li>
          <li>Upper Shavers Fork (section above Bemis)</li>
          <li>Lower Big Sandy</li>
          <li>Great Falls</li>
          <li>* Bonus: Russell Fork or Blackwater Gorge</li>
        </ul>

        <h4>Advanced (10 primo runs)</h4>
        <ul style={{ listStyleType: "square" }}>
          <li>Tygart Gorge or (lower) Middle Fork</li>
          <li>N. Br., Kitzmiller section</li>
          <li>Lower Gauley, WV</li>
          <li>New River Gorge</li>
          <li>Cheat Canyon</li>
          <li>Gooney Run, VA</li>
          <li>Savage River, lower</li>
          <li>Maury River (Devil's Kitchen section)</li>
          <li>Laurel Fork, Cheat (lower section)</li>
          <li>Wills Creek, PA (below Fairhope section)</li>
          <li>* Bonus: Buckhannon River (Alton to Sago)</li>
        </ul>

        <h4>Intermediate (10 great runs)</h4>
        <ul style={{ listStyleType: "square" }}>
          <li>Lower Yough</li>
          <li>Lost River Gorge</li>
          <li>Moorefield/Smokehole and/or Hopeville Canyons</li>
          <li>James River Fall Line</li>
          <li>Little Falls, Potomac (both MD & VA sides)</li>
          <li>Rock Creek, DC (Military rd. to Pierce Mill)</li>
          <li>Gunpowder River, below US 1</li>
          <li>Muddy Creek, PA (lower section)</li>
          <li>Mather Gorge ("O Deck" to I-495)</li>
          <li>Rappahannock Fall Line</li>
          <li>* Bonus: Passage Cr. (below Eliz. furnace) or Dry Fork</li>
        </ul>

        <h4>Novice (10 great runs)</h4>
        <ul style={{ listStyleType: "square" }}>
          <li>Rappahannock above Kelly's Ford</li>
          <li>Potomac "Needles section"</li>
          <li>Thornton River or Hughes River</li>
          <li>Cacapon River (US 50 to rt. 127)</li>
          <li>"Rap. Rap" (rt. 610, Rapidan to Motts Run, Rappahannock)</li>
          <li>Cedar Creek, VA</li>
          <li>Sideling Hill Creek, MD</li>
          <li>Violettes Lock loop</li>
          <li>Antietam Creek</li>
          <li>S. Fork Shenandoah, Newport to Luray or Comptons Section</li>
          <li>* Bonus: Paw Paw camper</li>
        </ul>
      </ClubSection>

      <ClubSection title="Ed's Classic Runs within 100 miles of DC">
        <p>
          The following are some of the "Classic" trips that define the DC
          paddling area. All rivers are tagged as "edclassic" for easy search.
        </p>
        <ol style={{ lineHeight: "1.6" }}>
          <li>Potomac's Mather Gorge. From Great Falls to 495.</li>
          <li>Potomac's Violette's Lock loop.</li>
          <li>Potomac's Little Falls.</li>
          <li>Potomac Needles through Harper's Ferry.</li>
          <li>Potomac's Paw Paw camper.</li>
          <li>Rock Creek below Military Road.</li>
          <li>Great Seneca Creek.</li>
          <li>Lower Goose Creek.</li>
          <li>Monocacy River.</li>
          <li>The Shenandoah Staircase.</li>
          <li>Antietam Creek.</li>
          <li>Cacapon River (rt. 50 to rt. 127).</li>
          <li>Sideling Hill Creek.</li>
          <li>Pohick Creek.</li>
          <li>South Fork Shenandoah.</li>
          <li>Gooney Run.</li>
          <li>Passage Creek.</li>
          <li>Cedar Creek.</li>
          <li>The Lost River gorge.</li>
          <li>Rappahannock's Kelly's Ford section.</li>
          <li>The Rap-Rap confluence.</li>
          <li>The Rappahannock Fall Line.</li>
          <li>The Hughes River run.</li>
          <li>The Thornton River.</li>
          <li>The Robinson River.</li>
          <li>Gunpowder River fall line.</li>
          <li>Deer Creek.</li>
          <li>Muddy Creek.</li>
          <li>Marsh Creek.</li>
          <li>The mighty James River Fall Line.</li>
        </ol>
      </ClubSection>

      <ClubSection title="Ed's Regional Write-ups">
        <ul style={{ listStyleType: "circle", lineHeight: "1.6" }}>
          <li>
            <Link to="/?search=Harpers%20Ferry">Harpers Ferry Area</Link>
          </li>
          <li>
            <Link to="/?search=New%20River%20WV">New River WV Area</Link>
          </li>
          <li>
            <Link to="/?search=Potomac%20Highlands">
              Potomac Highlands, WV & Canaan Valley
            </Link>
          </li>
          <li>
            <Link to="/?search=Shenandoah%20River,%20VA">
              Shenandoah River, VA
            </Link>
          </li>
          <li>
            <Link to="/?search=Cacapon">Cacapon/Lost River Basins</Link>
          </li>
          <li>
            <Link to="/?search=Washington%20DC">
              Washington DC metro area paddling
            </Link>
          </li>
          <li>
            <Link to="/?search=Lower%20Savage">
              Lower Savage & North Branch Area
            </Link>
          </li>
          <li>
            <Link to="/?search=Mighty%20Cheat">Mighty Cheat Basin</Link>
          </li>
          <li>
            <Link to="/?search=Youghiogheny">
              Youghiogheny River/Ohiopyle/Confluence PA
            </Link>
          </li>
          <li>
            <Link to="/?search=Blacksburg">Blacksburg area rivers</Link>
          </li>
        </ul>
      </ClubSection>
    </div>
  );
};

export default Clubs;
