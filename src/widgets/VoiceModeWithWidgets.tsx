import type { ReactNode } from "react";
import { WidgetsProvider, useWidgetsContext } from "./WidgetsContext";
import { WidgetSlot } from "./WidgetSlot";
import type { WidgetDefinition } from "./types";

// Render-prop contract: the parent passes a function that receives the
// composed tools map and the left/right slot nodes, and returns the
// LukeAudioWidget configured with them. This keeps the widget system
// decoupled from LukeAudioWidget's other required props (wsUrl, token,
// lukeConfig, etc.) — callers wire them as they already do.
export interface VoiceModeRenderArgs {
    tools: Record<string, unknown>;
    leftSlot: ReactNode;
    rightSlot: ReactNode;
}

interface VoiceModeWithWidgetsProps {
    widgets: WidgetDefinition[];
    children: (args: VoiceModeRenderArgs) => ReactNode;
}

function InnerBridge({ children }: { children: (args: VoiceModeRenderArgs) => ReactNode }) {
    const { tools, widgets } = useWidgetsContext();
    const hasLeft = widgets.some((w) => w.slot === "left");
    const hasRight = widgets.some((w) => w.slot === "right");
    return <>{children({
        tools: tools as Record<string, unknown>,
        leftSlot: hasLeft ? <WidgetSlot id="left" /> : null,
        rightSlot: hasRight ? <WidgetSlot id="right" /> : null,
    })}</>;
}

// Convenience component that wires a set of widgets into the LukeAudioWidget
// via a render-prop. Widgets are mounted through WidgetSlot inside the
// slot containers of LukeAudioWidget, and their tools are composed into
// a single map that the parent passes into LukeAudioWidget's `tools` prop.
//
// Usage:
//   <VoiceModeWithWidgets widgets={myWidgets}>
//     {({ tools, leftSlot, rightSlot }) => (
//       <LukeAudioWidget
//         wsUrl={url}
//         token={token}
//         lukeConfig={config}
//         tools={tools}
//         leftSlot={leftSlot}
//         rightSlot={rightSlot}
//       />
//     )}
//   </VoiceModeWithWidgets>
export function VoiceModeWithWidgets({ widgets, children }: VoiceModeWithWidgetsProps) {
    return (
        <WidgetsProvider widgets={widgets}>
            <InnerBridge>{children}</InnerBridge>
        </WidgetsProvider>
    );
}
