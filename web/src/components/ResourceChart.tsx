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
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-64 min-w-[300px]">
            <h3 className="text-gray-400 text-sm font-medium mb-4">{title}</h3>
            <div className="h-48 w-full">
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
