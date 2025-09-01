import { useColorMode } from '@docusaurus/theme-common';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Label, Tooltip, ReferenceLine } from 'recharts';

export const FlopsChart = () => {
    const { colorMode } = useColorMode();
    const isDark = colorMode === 'dark';

    return <AreaChart width={600} height={200} margin={{ top: 15, right: 50, left: 50, bottom: 15 }} data={
        [
            {name: 'Naive', flops: 309},
            {name: 'Coalescing', flops: 1986.6},
            {name: 'SMEM Cache', flops: 2980.3},
            {name: '1D Blocktiling', flops: 8474.7},
            {name: '2D Blocktiling', flops: 15971.7},
            {name: 'Vectorized', flops: 18237.3},
            {name: 'Autotuning', flops: 19721.0},
            {name: 'Warptiling', flops: 21779.0},
            {name: 'Double Buffering', flops: 23249.6},
        ]
    }>
        <CartesianGrid stroke={isDark ? '#ffffff' : '#aaa'} strokeDasharray="5 5" />
        <Area
            type="monotone"
            fill={isDark ? '#c8ff00' : '#dd8f8fff'}
            stroke={isDark ? '#ffffff' : '#000000'}
            strokeWidth={2}
            dataKey="flops"
        />
        <XAxis
            dataKey="name"
            interval={0}
            tickSize={10}
            tick={{fill: isDark ? '#ffffff' : '#000000', fontSize: 12, strokeWidth: 1, angle: -25}}
            type="category"
        />
        <YAxis
            dataKey="flops"
            tick={{fill: isDark ? '#ffffff' : '#000000', strokeWidth: 0.5, angle: 0}}
            label={{ value: 'FLOPs', fill: isDark ? '#ffffff' : '#000000', position: 'left', angle: -90 }}
            domain={['dataMin', 'dataMax']}
        />
        <ReferenceLine
            y={335000}
            isFront={true}
            label={{ value: "Peak FP64", fill: isDark ? '#ffffff' : '#000000' }} 
            fill="#ff0000ff"
            strokeWidth={2}
        />
        <ReferenceLine
            y={669000}
            isFront={true}
            label={{ value: "Peak FP32", fill: isDark ? '#ffffff' : '#000000' }} 
            fill="#ff0000ff"
            strokeWidth={2}
        />
        <Label
            value="Kernel FLOPs"
            fontSize={40}
            fill={isDark ? '#ffffff' : '#000000'}
            stroke={isDark ? '#ffffff' : '#000000'}
            zorder={1}
            offset={0}
            position="insideRight"
        />
        <Tooltip 
            cursor={true}
            label={{ fill: isDark ? '#ffffff' : '#000000' }} 
        />
    </AreaChart>
}
