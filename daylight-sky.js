// Presentation atmosphere only: no invented photographed site or solar survey.
// Pixel row zero is the lower pole, the middle row the real world horizon.
export const daylightSkySpec=Object.freeze({width:512,height:256,
 horizon:'#c4d3d9',fogNear:110,fogFar:230,terrainExtent:1000,
 approved:false,surveyVerified:false});
export function daylightSkyPixels(width=512,height=256){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<4||height<4||width>1024||height>512)throw Error('Invalid sky resolution');
 const pixels=new Uint8Array(width*height*4),horizon=[196,211,217],zenith=[103,143,176],lower=[151,169,170];
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let y=0;y<height;y++){
  const elevation=Math.sin((y/(height-1)-.5)*Math.PI),rise=smooth(Math.max(0,elevation)/.75),below=smooth(-elevation);
  for(let x=0;x<width;x++){
   const azimuth=x/(width-1)*Math.PI*2;
   const haze=(Math.sin(azimuth*3+elevation*5)+.45*Math.cos(azimuth*7-elevation*9))*.018*rise*(1-rise);
   const cloud=smooth((Math.sin(azimuth*2+elevation*10)+.28*Math.cos(azimuth*5-elevation*4)-.88)/.4)*smooth(elevation/.12)*(1-smooth((elevation-.55)/.3))*.12;
   const i=(y*width+x)*4;
   for(let c=0;c<3;c++){
    const sky=horizon[c]*(1-rise)+zenith[c]*rise;
    pixels[i+c]=Math.round(Math.max(0,Math.min(255,(sky*(1-below)+lower[c]*below)*(1-cloud)+232*cloud+haze*255)));
   }
   pixels[i+3]=255;
  }
 }
 return pixels;
}
