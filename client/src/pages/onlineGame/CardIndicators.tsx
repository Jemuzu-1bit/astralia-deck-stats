import { gameConnection, type GameCounter } from "../../services/gameConnection";
import { normalizeShortcut, useGameShortcuts } from "../gameShortcuts";
import fragmentCard from "../../assets/fragment.png";
import { STATUS_COUNTERS, type CardStat } from "./model";
import styles from "../OnlineGamePage.module.scss";

export function FragmentDock({ fragments, readOnly = false }: { fragments: boolean[]; readOnly?: boolean }) {
  const FRAGMENT_KEYS = useGameShortcuts().fragment;
  const available = fragments.filter((spent) => !spent).length;
  const spent = fragments.length - available;

  return <section className={styles.fragmentDock} data-fragment-dock aria-label={`Fragments, ${available} available and ${spent} spent`}>
    <div className={styles.fragmentHeader}>
      <div>
        <strong>Fragment</strong>
        <span>{available} ready · {spent} spent</span>
      </div>
      {!readOnly && <div className={styles.fragmentControls}>
        <button type="button" onClick={() => gameConnection.updateFragments("remove")} disabled={fragments.length === 0} aria-label="Remove a fragment" title={`Remove a fragment · ${FRAGMENT_KEYS.remove}`}>−</button>
        <button type="button" onClick={() => gameConnection.updateFragments("add")} disabled={fragments.length >= 10} aria-label="Add a fragment" title={`Add a fragment · ${FRAGMENT_KEYS.add}`}>+</button>
        <button type="button" onClick={() => gameConnection.updateFragments("spend")} disabled={available === 0} title={`Spend · ${FRAGMENT_KEYS.spend}`}>Spend</button>
        <button type="button" onClick={() => gameConnection.updateFragments("recover")} disabled={spent === 0} title={`Recover · ${FRAGMENT_KEYS.recover}`}>Recover</button>
        <button type="button" onClick={() => gameConnection.updateFragments("spendAll")} disabled={available === 0} title={`Spend all · ${FRAGMENT_KEYS.spendAll}`}>Spend all</button>
        <button type="button" onClick={() => gameConnection.updateFragments("recoverAll")} disabled={spent === 0} title={`Recover all · ${FRAGMENT_KEYS.recoverAll}`}>Recover all</button>
      </div>}
    </div>
    <div className={styles.fragmentRail}>
      {fragments.map((isSpent, index) => <button
        key={index}
        type="button"
        disabled={readOnly}
        className={isSpent ? styles.spentFragment : ""}
        onClick={() => gameConnection.setFragmentSpent(index, !isSpent)}
        aria-label={`Fragment ${index + 1}, ${isSpent ? "spent" : "available"}${readOnly ? "" : isSpent ? ". Recover it" : ". Spend it"}`}
        title={isSpent ? readOnly ? "Spent" : `Spent · ${FRAGMENT_KEYS[`toggle${index + 1}` as keyof typeof FRAGMENT_KEYS]} to recover` : readOnly ? "Available" : `Available · ${FRAGMENT_KEYS[`toggle${index + 1}` as keyof typeof FRAGMENT_KEYS]} to spend`}
      >
        <img src={fragmentCard} alt="" draggable={false} />
      </button>)}
      {fragments.length === 0 && <span className={styles.fragmentEmpty}>Add a Fragment</span>}
    </div>
  </section>;
}

export function FrazzleCounter({ uid, value, editable, onAdjust }: {
  uid: string;
  value: number;
  editable: boolean;
  onAdjust: (delta: -1 | 1) => void;
}) {
  const COUNTER_KEYS = useGameShortcuts().counter;
  if (value < 1) return null;
  const adjust = (delta: -1 | 1) => {
    if (editable) onAdjust(delta);
  };
  return <span
    data-game-counter="frazzle"
    data-counter-uid={uid}
    className={`${styles.frazzleCounter} ${editable ? styles.editableFrazzleCounter : ""}`}
    role={editable ? "button" : undefined}
    tabIndex={editable ? 0 : undefined}
    aria-label={editable ? `Frazzle ${value}. Left click increases it, right click decreases it.` : `Frazzle ${value}`}
    title={editable ? `Left click or ${COUNTER_KEYS.increase}: +1 Frazzle · Right click or ${COUNTER_KEYS.decrease}: -1 Frazzle` : `Frazzle ${value}`}
    onPointerDown={editable ? (event) => event.stopPropagation() : undefined}
    onClick={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(1); } : undefined}
    onContextMenu={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(-1); } : undefined}
    onKeyDown={editable ? (event) => {
      const key = normalizeShortcut(event.nativeEvent);
      if (key === COUNTER_KEYS.increase) { event.preventDefault(); adjust(1); }
      if (key === COUNTER_KEYS.decrease) { event.preventDefault(); adjust(-1); }
    } : undefined}
  >{value}</span>;
}

export function StatCounter({ uid, stat, value, editable, onAdjust }: {
  uid: string;
  stat: CardStat;
  value: number;
  editable: boolean;
  onAdjust: (delta: -1 | 1) => void;
}) {
  const COUNTER_KEYS = useGameShortcuts().counter;
  const label = stat.toUpperCase();
  const adjust = (delta: -1 | 1) => {
    if (editable) onAdjust(delta);
  };
  return <span
    data-game-counter={stat}
    data-counter-uid={uid}
    className={`${styles.statCounter} ${styles[`${stat}Counter`]} ${editable ? styles.editableStatCounter : ""}`}
    role={editable ? "button" : undefined}
    tabIndex={editable ? 0 : undefined}
    aria-label={editable ? `${label} ${value}. Left click increases it, right click decreases it.` : `${label} ${value}`}
    title={editable ? `Left click or ${COUNTER_KEYS.increase}: +1 ${label} · Right click or ${COUNTER_KEYS.decrease}: -1 ${label}` : `${label} ${value}`}
    onPointerDown={editable ? (event) => event.stopPropagation() : undefined}
    onClick={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(1); } : undefined}
    onContextMenu={editable ? (event) => { event.preventDefault(); event.stopPropagation(); adjust(-1); } : undefined}
    onKeyDown={editable ? (event) => {
      const key = normalizeShortcut(event.nativeEvent);
      if (key === COUNTER_KEYS.increase) { event.preventDefault(); adjust(1); }
      if (key === COUNTER_KEYS.decrease) { event.preventDefault(); adjust(-1); }
    } : undefined}
  ><small>{label}</small>{value}</span>;
}

export function CustomCounter({ uid, counter, editable, onAdjust }: {
  uid: string;
  counter: GameCounter;
  editable: boolean;
  onAdjust: (delta: -1 | 1) => void;
}) {
  const COUNTER_KEYS = useGameShortcuts().counter;
  const isStatus = counter.kind === "status";
  const description = isStatus ? counter.label : `${counter.label} counter: ${counter.value}`;
  return <span
    data-game-counter="custom"
    data-counter-uid={uid}
    data-counter-kind={counter.kind}
    data-counter-label={counter.label}
    data-counter-emoji={counter.emoji}
    className={`${styles.customCounter} ${isStatus ? styles.statusCounter : ""} ${editable ? styles.editableCustomCounter : ""}`}
    role={editable ? "button" : undefined}
    tabIndex={editable ? 0 : undefined}
    aria-label={editable ? isStatus ? `${description}. Right click removes it.` : `${description}. Left click adds one, right click removes one.` : description}
    title={editable ? isStatus ? `${description} · Right click or ${COUNTER_KEYS.remove} to remove` : `${description} · Left click or ${COUNTER_KEYS.increase} to add · Right click or ${COUNTER_KEYS.decrease} to remove` : description}
    onPointerDown={editable ? (event) => event.stopPropagation() : undefined}
    onClick={editable ? (event) => { event.preventDefault(); event.stopPropagation(); if (counter.kind !== "status") onAdjust(1); } : undefined}
    onContextMenu={editable ? (event) => { event.preventDefault(); event.stopPropagation(); onAdjust(-1); } : undefined}
    onKeyDown={editable ? (event) => {
      const key = normalizeShortcut(event.nativeEvent);
      if (key === COUNTER_KEYS.increase) { event.preventDefault(); if (!isStatus) onAdjust(1); }
      if (key === COUNTER_KEYS.decrease) { event.preventDefault(); onAdjust(-1); }
      if (key === COUNTER_KEYS.remove && isStatus) { event.preventDefault(); onAdjust(-1); }
    } : undefined}
  ><span>{isStatus ? STATUS_COUNTERS.find((item) => item.label === counter.label)?.short ?? counter.label.slice(0, 2) : counter.emoji || counter.label.slice(0, 3)}</span>{!isStatus && <b>{counter.value}</b>}</span>;
}
