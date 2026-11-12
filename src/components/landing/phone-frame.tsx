import Image from "next/image";

// Bingkai telefon CSS untuk tangkapan skrin LMS (akaun ujian, nama rekaan; tiada data pelajar sebenar).
export function PhoneFrame({ src, alt, width, height, caption }: { src: string; alt: string; width: number; height: number; caption: string }) {
  return (
    <figure className="w-[44%] max-w-[210px]">
      <div className="overflow-hidden rounded-[1.75rem] border-[6px] border-ink bg-ink">
        <Image src={src} alt={alt} width={width} height={height} sizes="210px" className="h-auto w-full" />
      </div>
      <figcaption className="mt-2 text-center text-sm text-muted">{caption}</figcaption>
    </figure>
  );
}
