'use client';

import { useConfig } from '@/app/[locale]/config';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { IconEverworksSimple } from '@/components/icons/Icons';
import { SoiGuruMark } from '@/components/soiguru/logo-mark';
import { isExternalUrl } from '@/lib/utils/custom-navigation';

/**
 * Fallback mark shown next to the company name when the config has neither a
 * logo image nor a favicon. `soiguru` (default) draws the SoiGuru karst tile;
 * `NEXT_PUBLIC_BRAND_MARK=everworks` restores the template's Ever Works icon.
 */
const BRAND_MARK = process.env.NEXT_PUBLIC_BRAND_MARK === 'everworks' ? 'everworks' : 'soiguru';

/** Pixel size of the SoiGuru mark per logo size (moodboard: 34px in a top bar). */
const MARK_SIZES = { sm: 34, md: 36, lg: 44 } as const;

export interface SiteLogoProps {
	size?: 'sm' | 'md' | 'lg';
	className?: string;
	showText?: boolean;
	linkToHome?: boolean;
}

const SIZE_CONFIGS = {
	sm: {
		icon: 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 2xl:w-11 2xl:h-11',
		text: 'text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl',
		image: { width: 140, height: 50 },
		imageClass: 'h-8 sm:h-9 md:h-10 w-auto',
		iconMargin: 'mr-2 sm:mr-3 md:mr-4 lg:mr-5'
	},
	md: {
		icon: 'w-8 h-8 md:w-10 md:h-10',
		text: 'text-sm md:text-base lg:text-lg',
		image: { width: 140, height: 50 },
		imageClass: 'h-10 md:h-11 w-auto',
		iconMargin: 'mr-3'
	},
	lg: {
		icon: 'w-10 h-10 md:w-12 md:h-12',
		text: 'text-base md:text-lg lg:text-xl',
		image: { width: 140, height: 50 },
		imageClass: 'h-11 md:h-12 w-auto',
		iconMargin: 'mr-4'
	}
};

export function SiteLogo({ size = 'md', className = '', showText = true, linkToHome = true }: SiteLogoProps) {
	const config = useConfig();
	const { resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const sizeConfig = SIZE_CONFIGS[size];
	const logoSettings = config.logo;
	const hasImageLogo = !!logoSettings?.logo_image;

	// Determine which image to use based on theme
	const getLogoImage = () => {
		if (!logoSettings?.logo_image) return null;

		// Use dark variant if available and theme is dark
		if (resolvedTheme === 'dark' && logoSettings.logo_image_dark) {
			return logoSettings.logo_image_dark;
		}

		return logoSettings.logo_image;
	};

	const renderLogoContent = () => {
		// Only the image logo depends on the resolved colour scheme; the text
		// logo (favicon or brand mark + name) renders the same on server and client.
		if (!mounted && hasImageLogo) {
			// Return placeholder during SSR to avoid hydration mismatch
			return <div className={`animate-pulse bg-gray-200 dark:bg-white/8 rounded ${sizeConfig.icon}`} />;
		}

		if (hasImageLogo) {
			// Mode A: Image logo only
			const logoSrc = getLogoImage();
			if (!logoSrc) return null;

			// Use next/image with unoptimized for external URLs to avoid Next.js optimization issues
			return (
				<Image
					src={logoSrc}
					alt={config.company_name || 'Logo'}
					width={sizeConfig.image.width}
					height={sizeConfig.image.height}
					className={sizeConfig.imageClass}
					priority
					unoptimized={isExternalUrl(logoSrc)}
				/>
			);
		}

		// Mode B: Text (company name) + optional favicon icon
		return (
			<>
				{logoSettings?.favicon && (
					<div className={`relative ${sizeConfig.iconMargin}`}>
						<Image
							src={logoSettings.favicon}
							alt={config.company_name || 'Site icon'}
							width={40}
							height={40}
							className={`${sizeConfig.icon}`}
						/>
					</div>
				)}
				{!logoSettings?.favicon && BRAND_MARK === 'everworks' && (
					<div className={`relative ${sizeConfig.iconMargin}`}>
						<IconEverworksSimple
							className={`${sizeConfig.icon}`}
						/>
					</div>
				)}
				{!logoSettings?.favicon && BRAND_MARK === 'soiguru' && (
					<div className="relative mr-2.5 shrink-0">
						<SoiGuruMark size={MARK_SIZES[size]} className="block" />
					</div>
				)}
				{showText && (
					<p
						className={`sg-wordmark font-bold ${sizeConfig.text} transition-colors duration-200 group-hover:text-theme-primary`}
					>
						{config.company_name}
					</p>
				)}
			</>
		);
	};

	const containerClasses = `flex items-center group ${className}`;

	if (linkToHome) {
		return (
			<Link href="/" className={containerClasses}>
				{renderLogoContent()}
			</Link>
		);
	}

	return <div className={containerClasses}>{renderLogoContent()}</div>;
}
