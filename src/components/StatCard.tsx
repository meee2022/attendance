import React from "react";

export type StatCardColor = "maroon" | "green" | "amber" | "blue" | "purple" | "teal" | "rose";

const COLOR_MAP: Record<StatCardColor, {
    bar: string;
    iconBg: string;
    iconText: string;
    labelText: string;
    cardBg: string;
}> = {
    maroon: { bar: "bg-qatar-maroon",  iconBg: "bg-rose-100",    iconText: "text-qatar-maroon", labelText: "text-qatar-maroon/80", cardBg: "bg-rose-50/30" },
    green:  { bar: "bg-emerald-500",   iconBg: "bg-emerald-100", iconText: "text-emerald-600",  labelText: "text-emerald-700",     cardBg: "bg-emerald-50/30" },
    amber:  { bar: "bg-amber-500",     iconBg: "bg-amber-100",   iconText: "text-amber-600",    labelText: "text-amber-700",       cardBg: "bg-amber-50/30" },
    blue:   { bar: "bg-blue-500",      iconBg: "bg-blue-100",    iconText: "text-blue-600",     labelText: "text-blue-700",        cardBg: "bg-blue-50/30" },
    purple: { bar: "bg-purple-500",    iconBg: "bg-purple-100",  iconText: "text-purple-600",   labelText: "text-purple-700",      cardBg: "bg-purple-50/30" },
    teal:   { bar: "bg-teal-500",      iconBg: "bg-teal-100",    iconText: "text-teal-600",     labelText: "text-teal-700",        cardBg: "bg-teal-50/30" },
    rose:   { bar: "bg-rose-500",      iconBg: "bg-rose-100",    iconText: "text-rose-600",     labelText: "text-rose-700",        cardBg: "bg-rose-50/30" },
};

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: React.ReactNode;
    color?: StatCardColor;
}

export default function StatCard({ label, value, subValue, icon, color = "maroon" }: StatCardProps) {
    const c = COLOR_MAP[color];

    return (
        <div className={`relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex ${c.cardBg}`}>

            {/* Card content */}
            <div className="flex items-center justify-between gap-3 px-4 py-4 flex-1 min-w-0 bg-white/70">
                {/* Text side */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-relaxed ${c.labelText}`}>{label}</p>
                    <p className="text-2xl font-bold tabular-nums text-slate-800 leading-none">{value}</p>
                    {subValue && <p className="text-[10px] sm:text-xs font-normal text-slate-500">{subValue}</p>}
                </div>

                {/* Icon side */}
                <div className={`w-9 h-9 [&>svg]:w-5 [&>svg]:h-5 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg} ${c.iconText}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}
