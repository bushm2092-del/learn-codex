import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export interface LessonTimelineControls {
  play: () => void;
  pause: () => void;
  restart: () => void;
}

export interface LessonTimelineContext {
  reduceMotion: boolean;
  timeline: gsap.core.Timeline;
}

type TimelineBuilder = (context: LessonTimelineContext) => void;

export function useLessonTimeline(
  scope: RefObject<HTMLElement | null>,
  build: TimelineBuilder,
): LessonTimelineControls {
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add(
        {
          // matchMedia 至少需要一个条件匹配，普通动态模式也必须创建时间线。
          all: "(min-width: 0px)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const timeline = gsap.timeline({
            paused: true,
            defaults: {
              duration: context.conditions?.reduceMotion ? 0 : 0.55,
              ease: "power3.out",
            },
          });

          timelineRef.current = timeline;
          build({
            reduceMotion: Boolean(context.conditions?.reduceMotion),
            timeline,
          });

          return () => {
            timeline.kill();
            timelineRef.current = null;
          };
        },
        scope.current ?? undefined,
      );

      return () => media.revert();
    },
    { scope, dependencies: [build], revertOnUpdate: true },
  );

  return {
    play: () => timelineRef.current?.play(),
    pause: () => timelineRef.current?.pause(),
    restart: () => timelineRef.current?.restart(),
  };
}
