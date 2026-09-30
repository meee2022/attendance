// Read drawing bounds in page coordinates, respecting the PDF graphics stack.
// Thin filled rectangles are how Excel exports table borders.
export function pdfHorizontalRules(ops: { fnArray: ArrayLike<number>; argsArray: any[] }, codes: Record<string, number>, pageHeight: number) {
    type Matrix = [number, number, number, number, number, number];
    let m: Matrix = [1,0,0,1,0,0]; const stack: Matrix[]=[];
    const rules: {left:number;right:number;y:number}[]=[];
    for(let i=0;i<ops.fnArray.length;i++) {
        const fn=ops.fnArray[i], a=ops.argsArray[i];
        if(fn===codes.save) stack.push([...m]);
        else if(fn===codes.restore) m=stack.pop() ?? [1,0,0,1,0,0];
        else if(fn===codes.transform) {
            const [x,y,z,w,tx,ty]=a;
            m=[m[0]*x+m[2]*y,m[1]*x+m[3]*y,m[0]*z+m[2]*w,m[1]*z+m[3]*w,m[0]*tx+m[2]*ty+m[4],m[1]*tx+m[3]*ty+m[5]];
        } else if(fn===codes.constructPath && a[2] && Math.abs(m[1])+Math.abs(m[2])<0.001) {
            const b=a[2];
            const left=b[0]*m[0]+m[4],right=b[2]*m[0]+m[4];
            const top=pageHeight-(b[3]*m[3]+m[5]),bottom=pageHeight-(b[1]*m[3]+m[5]);
            if(right-left>40 && Math.abs(bottom-top)<1.5) rules.push({left,right,y:(top+bottom)/2});
        }
    }
    return rules;
}
