import { CURRENT_FLOW_VERSION, FLOW_REGISTRY, type RoomType } from '@marketplace/shared';
import { getIllustration } from './index';

export interface AnswerVisualCoverage {
  roomType: string;
  flowVersion: number;
  current: boolean;
  stepId: string;
  value: string;
  renderer: string;
  visual: string;
}

// Manifest calculat din registrul real, inclusiv versiunile FROZEN.
export function answerVisualCoverage(): AnswerVisualCoverage[] {
  return Object.entries(FLOW_REGISTRY).flatMap(([roomType, versions]) =>
    Object.entries(versions).flatMap(([version, flow]) =>
      flow.steps.flatMap((step) => {
        const values = step.type === 'single-choice' || step.type === 'multi-choice'
          ? step.options.map((option) => option.value)
          : step.type === 'boolean' ? ['YES', 'NO'] : [];
        return values.map((value) => {
          const Illustration = getIllustration(roomType as RoomType, step.id, value);
          const componentName = Illustration ? Illustration.displayName ?? Illustration.name : '';
          return {
            roomType,
            flowVersion: Number(version),
            current: CURRENT_FLOW_VERSION[roomType as RoomType] === Number(version),
            stepId: step.id,
            value,
            renderer: step.type === 'boolean' ? 'boolean-card' : step.screenGroup ? 'card-or-inline-pill' : 'card',
            visual: componentName.startsWith('Showroom(') || componentName.startsWith('OptionPhoto(') ? componentName : componentName === 'PhotoIllustration' ? 'existing-material-opening-photo' : Illustration ? `retained-diagram:${componentName}` : step.type === 'boolean' ? 'boolean-symbol' : 'fallback-icon',
          };
        });
      }),
    ),
  );
}
