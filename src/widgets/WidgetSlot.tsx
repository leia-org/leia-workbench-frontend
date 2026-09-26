import { useWidgetsContext } from "./WidgetsContext";
import type { SlotId } from "./types";

interface WidgetSlotProps {
    id: SlotId;
}

// Renders every widget assigned to a slot, stacked vertically and sharing
// the slot's height equally. If no widget is assigned the slot takes no
// space, so LukeAudioWidget's layout stays unchanged when voice mode has no
// widgets. Was `.find()` + single Component: a second widget assigned to the
// same slot would silently never mount, so its tools never registered either.
export function WidgetSlot({ id }: WidgetSlotProps) {
    const { widgetsForSlot } = useWidgetsContext();
    const widgets = widgetsForSlot(id);
    if (widgets.length === 0) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            {widgets.map(({ id: widgetId, Component, props }, i) => (
                <div
                    key={widgetId}
                    style={{
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.12)" : undefined,
                    }}
                >
                    <Component {...(props ?? {})} />
                </div>
            ))}
        </div>
    );
}
