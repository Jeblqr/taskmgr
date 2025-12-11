import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ResourceChartProps {
    data: any[];
    dataKey: string;
    color: string;
    title: string;
    unit?: string;
}

export default function ResourceChart({ data, dataKey, color, title, unit = "%" }: ResourceChartProps) {
    return (
        <div className="glass-card p-6 h-72 min-w-[300px]">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-6 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                {title}
            </h3>
            <div className="h-56 w-full -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={val => `${val}${unit}`} domain={[0, 100]} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => [`${value.toFixed(1)}${unit}`, title]}
                        />
                        <Line 
                            type="monotone" 
                            dataKey={dataKey} 
                            stroke={color} 
                            strokeWidth={2} 
                            dot={false} 
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
