import { Directive, ElementRef, OnDestroy, OnInit, inject, output } from '@angular/core';

/**
 * Lightweight scroll-reveal: adds `.is-visible` the first time the host enters the viewport.
 * No animation library — just an IntersectionObserver + CSS transition (see landing.component.scss).
 * Respects `prefers-reduced-motion` by revealing immediately without waiting to observe.
 * Emits `appRevealed` once, so consumers can trigger side effects (e.g. count-up numbers).
 */
@Directive({
  selector: '[appRevealOnScroll]',
  standalone: true,
  host: { class: 'reveal-on-scroll' },
})
export class RevealOnScrollDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  readonly appRevealed = output<void>();

  ngOnInit(): void {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      this.el.nativeElement.classList.add('is-visible');
      this.appRevealed.emit();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.el.nativeElement.classList.add('is-visible');
            this.appRevealed.emit();
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
