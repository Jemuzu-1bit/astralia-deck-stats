import { useEffect, useState, type RefObject } from "react";
import type { TargetLink, TargetPath } from "./model";
import styles from "../OnlineGamePage.module.scss";

export function TargetArrows({ links, containerRef }: { links: TargetLink[]; containerRef: RefObject<HTMLDivElement | null> }) {
  const [paths, setPaths] = useState<TargetPath[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    let retry = 0;
    let retryTimer: number | undefined;
    let expiryTimer: number | undefined;

    const update = () => {
      const now = Date.now();
      const activeLinks = links.filter((link) => link.expiresAt > now);
      const bounds = container.getBoundingClientRect();
      const elements = new Map<string, HTMLElement>();
      container.querySelectorAll<HTMLElement>("[data-card-uid]").forEach((element) => {
        const uid = element.dataset.cardUid;
        if (uid && !elements.has(uid)) elements.set(uid, element);
      });

      const nextPaths = activeLinks.flatMap((link) => {
        const source = elements.get(link.sourceUid)?.getBoundingClientRect();
        const target = elements.get(link.targetUid)?.getBoundingClientRect();
        if (!source || !target) return [];

        const sourceX = source.left - bounds.left + source.width / 2;
        const sourceY = source.top - bounds.top + source.height / 2;
        const targetX = target.left - bounds.left + target.width / 2;
        const targetY = target.top - bounds.top + target.height / 2;
        if (link.sourceUid === link.targetUid) {
          const direction = sourceX < bounds.width * .68 ? 1 : -1;
          const edgeX = sourceX + direction * (source.width / 2 + 5);
          const startY = sourceY + source.height * .23;
          const endY = sourceY - source.height * .23;
          const controlX = edgeX + direction * Math.max(58, source.width * .72);
          return [{
            ...link,
            startX: edgeX,
            startY,
            path: `M ${edgeX} ${startY} C ${controlX} ${sourceY + source.height * .52}, ${controlX} ${sourceY - source.height * .52}, ${edgeX} ${endY}`,
          }];
        }
        const deltaX = targetX - sourceX;
        const deltaY = targetY - sourceY;
        const distance = Math.hypot(deltaX, deltaY);
        if (distance < 1) return [];

        const unitX = deltaX / distance;
        const unitY = deltaY / distance;
        const sourceEdge = Math.min(
          Math.abs(unitX) < .001 ? Infinity : source.width / 2 / Math.abs(unitX),
          Math.abs(unitY) < .001 ? Infinity : source.height / 2 / Math.abs(unitY),
        );
        const targetEdge = Math.min(
          Math.abs(unitX) < .001 ? Infinity : target.width / 2 / Math.abs(unitX),
          Math.abs(unitY) < .001 ? Infinity : target.height / 2 / Math.abs(unitY),
        );
        if (distance < sourceEdge + targetEdge + 28) {
          if (Math.abs(deltaX) >= Math.abs(deltaY)) {
            const direction = Math.sign(deltaX) || 1;
            const startX = sourceX + direction * Math.min(12, source.width * .16);
            const startY = source.top - bounds.top - 5;
            const endX = targetX - direction * Math.min(12, target.width * .16);
            const endY = target.top - bounds.top - 10;
            const controlX = (startX + endX) / 2;
            const controlY = Math.min(startY, endY) - Math.min(62, Math.max(34, distance * .55));
            return [{
              ...link,
              startX,
              startY,
              path: `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`,
            }];
          }

          const direction = sourceX < bounds.width * .68 ? 1 : -1;
          const startX = sourceX + direction * (source.width / 2 + 5);
          const startY = sourceY + Math.sign(deltaY) * Math.min(12, source.height * .12);
          const endX = targetX + direction * (target.width / 2 + 10);
          const endY = targetY - Math.sign(deltaY) * Math.min(12, target.height * .12);
          const controlX = Math.max(startX * direction, endX * direction) * direction + direction * 45;
          const controlY = (startY + endY) / 2;
          return [{
            ...link,
            startX,
            startY,
            path: `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`,
          }];
        }
        const startX = sourceX + unitX * (sourceEdge + 5);
        const startY = sourceY + unitY * (sourceEdge + 5);
        const endX = targetX - unitX * (targetEdge + 11);
        const endY = targetY - unitY * (targetEdge + 11);
        const bend = Math.min(92, Math.max(28, distance * .16));
        const curveDirection = link.sourceUid < link.targetUid ? 1 : -1;
        const normalX = -unitY * bend * curveDirection;
        const normalY = unitX * bend * curveDirection;
        const controlX = (startX + endX) / 2 + normalX;
        const controlY = (startY + endY) / 2 + normalY;

        return [{
          ...link,
          startX,
          startY,
          path: `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`,
        }];
      });

      setSize({ width: container.clientWidth, height: container.clientHeight });
      setPaths(nextPaths);
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      const nextExpiry = activeLinks.reduce((earliest, link) => Math.min(earliest, link.expiresAt), Infinity);
      if (Number.isFinite(nextExpiry)) expiryTimer = window.setTimeout(scheduleUpdate, Math.max(0, nextExpiry - now + 20));
      if (nextPaths.length < activeLinks.length && retry < 20) {
        retry += 1;
        retryTimer = window.setTimeout(scheduleUpdate, 150);
      }
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(container);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    scheduleUpdate();
    return () => {
      window.cancelAnimationFrame(frame);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [containerRef, links]);

  if (paths.length === 0) return null;
  return <svg className={styles.targetArrows} width={size.width} height={size.height} aria-hidden="true">
    <defs>
      {(["target", "attack", "block"] as const).map((kind) => <marker key={kind} id={`${kind}-arrow-head`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={kind === "attack" ? "#f14646" : kind === "block" ? "#2e8fff" : "#f6b936"} />
      </marker>)}
    </defs>
    {paths.map(({ sourceUid, targetUid, path, startX, startY, kind }) => <g key={`${sourceUid}:${targetUid}:${kind}`} className={kind === "attack" ? styles.attackArrowGroup : kind === "block" ? styles.blockArrowGroup : styles.targetArrowGroup}>
      <path className={styles.targetArrowGlow} d={path} />
      <path className={styles.targetArrow} d={path} markerEnd={`url(#${kind}-arrow-head)`} />
      <path className={styles.targetArrowFlow} d={path} />
      <circle className={styles.targetArrowOrigin} cx={startX} cy={startY} r="4" />
    </g>)}
  </svg>;
}
