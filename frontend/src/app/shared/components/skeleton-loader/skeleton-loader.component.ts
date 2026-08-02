import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

export type SkeletonShape = 'text' | 'circle' | 'rect';

@Component({
  selector: 'app-skeleton-loader',
  imports: [CommonModule],
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.scss'
})
export class SkeletonLoaderComponent {
  readonly shape = input<SkeletonShape>('text');
  readonly width = input('100%');
  readonly height = input('1rem');

}
